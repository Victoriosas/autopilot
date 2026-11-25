import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { consumeCloudHandoff, type CloudHandoffPolicy, type CloudLedgerHandoff, type CloudHandoffReceipt } from './cloudLedgerHandoff';
import { CloudMissionStore } from './cloudMissionStore';
import { createMissionLedger, PersistentMissionOrchestrator } from './missionRuntime';
import { observeAgents, type AgentTaskObservation } from './agentObservation';
import { AGENT_IDS } from './sixAgentControlPlane';
import type { ExecutorAdapter, ExecutorContext, MissionCheckpoint, MissionLedger } from './executorAdapter';

export const DIRECTOR_SYNTHETIC_MISSION='synthetic-director-supervision';
export const DIRECTOR_SYNTHETIC_EXECUTOR='director-cloud-synthetic';
export interface DirectorCloudGrant {
  missionId:string;binding:string;reviewedSha:string;slot:string;authorizationId:string;
  hostIdentity:'autopilot_cloud_runner';notBefore:string;expiresAt:string;
}
const exact=(v:unknown,keys:string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)
  &&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const iso=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(v)&&Number.isFinite(Date.parse(v));
export function directorSlot(now=new Date()):string {
  const d=new Date(now);d.setUTCMinutes(d.getUTCMinutes()<30?0:30,0,0);return d.toISOString().replace('.000Z','Z');
}
export function validateDirectorGrant(value:unknown,store:CloudMissionStore,now=new Date()):DirectorCloudGrant {
  const g=value as DirectorCloudGrant;
  if(!exact(g,['missionId','binding','reviewedSha','slot','authorizationId','hostIdentity','notBefore','expiresAt'])
    ||g.missionId!==DIRECTOR_SYNTHETIC_MISSION||g.binding!==store.binding||g.reviewedSha!==store.reviewedBaseSha
    ||!/^director-auth-[a-z0-9-]{8,64}$/.test(g.authorizationId)||g.hostIdentity!==store.hostIdentity
    ||g.hostIdentity!=='autopilot_cloud_runner'||!/^\d{4}-\d{2}-\d{2}T\d{2}:(00|30):00Z$/.test(g.slot)
    ||g.slot!==directorSlot(now)||!iso(g.notBefore)||!iso(g.expiresAt)
    ||Date.parse(g.notBefore)>+now||Date.parse(g.expiresAt)<=+now
    ||Date.parse(g.expiresAt)>Date.parse(g.slot)+30*60_000)throw Error('director_authorization_denied');
  if(store.config.permissions.execute!==true||store.config.permissions.admit!==false||store.config.permissions.cancel!==false)
    throw Error('cloud_director_execution_disabled');
  return structuredClone(g);
}

function stable(value:unknown):string {
  return JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)
    ?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
}
function summarizeRows(rows:AgentTaskObservation[],now=new Date()) {
  if(!Array.isArray(rows)||rows.length>500||rows.some(row=>typeof row?.id!=='string'
    ||!row.id.startsWith('synthetic-director-')||!AGENT_IDS.includes(row.agent_id as never)))throw Error('director_synthetic_scope_denied');
  const agents=observeAgents(rows,now).map(a=>({id:a.id,configuredState:a.configuredState,
    pending:a.pending,completedDeclaredEvidence:a.completed,completedUnverified:a.completionUnverified,
    completedWithoutEvidence:a.completionWithoutEvidence,blocked:a.blocked,liveClaims:a.running,
    expiredOrInvalidClaims:a.staleClaims,evidenceVerified:0,activityStatus:a.activityStatus,runtimeStatus:'unknown'}));
  return {schemaVersion:1,no_send:true,no_dispatch:true,agents};
}
function validateSummary(value:unknown):boolean {
  const s=value as {schemaVersion:number;no_send:boolean;no_dispatch:boolean;agents:Array<Record<string,unknown>>};
  return !!s&&s.schemaVersion===1&&s.no_send===true&&s.no_dispatch===true&&Array.isArray(s.agents)
    &&s.agents.length===AGENT_IDS.length&&s.agents.every((a,i)=>a?.id===AGENT_IDS[i]
      &&a.evidenceVerified===0&&a.runtimeStatus==='unknown'
      &&['pending','completedDeclaredEvidence','completedUnverified','completedWithoutEvidence','blocked','liveClaims','expiredOrInvalidClaims']
        .every(k=>Number.isSafeInteger(a[k])&&Number(a[k])>=0));
}

export class DirectorSyntheticExecutor implements ExecutorAdapter {
  readonly executorId=DIRECTOR_SYNTHETIC_EXECUTOR;
  constructor(private readonly readAggregates:()=>Promise<AgentTaskObservation[]>,private readonly reviewedSha:string,private readonly slot:string) {}
  async execute(context:ExecutorContext):Promise<{checkpoint:MissionCheckpoint;events:[];evidence:string[]}> {
    if(context.executorId!==this.executorId||context.mission.missionId!==DIRECTOR_SYNTHETIC_MISSION
      ||context.mission.goal!=='Observe approved synthetic six-agent aggregates'
      ||context.mission.goalVersion!==1||context.mission.planVersion!==1
      ||stable(context.mission.restrictions)!==stable(['synthetic_only','no_send','no_dispatch'])
      ||stable(context.mission.plan)!==stable([
        {id:'observe-ledger',task:'observe synthetic ledger',depends_on:[]},
        {id:'verify-observation',task:'verify persisted observation',depends_on:['observe-ledger']},
      ]))throw Error('director_mission_denied');
    const step=context.checkpoint.current_step_id;
    let summary:string;
    if(step==='observe-ledger') summary=JSON.stringify(summarizeRows(await this.readAggregates()));
    else if(step==='verify-observation') {
      const previous=context.checkpoint.results.find(r=>r.step_id==='observe-ledger');
      let first:unknown;
      try {first=JSON.parse(previous?.summary??'null');} catch {throw Error('director_checkpoint_invalid');}
      if(!validateSummary(first)||stable(first)!==stable(summarizeRows(await this.readAggregates())))
        throw Error('director_observation_mismatch');
      summary=`verified:${createHash('sha256').update(stable(first)).digest('hex')}:${this.reviewedSha}:${this.slot}`;
    } else throw Error('director_step_denied');
    const completed=[...context.checkpoint.completed_steps,step];
    const pending=context.mission.plan.filter(s=>!completed.includes(s.id)).map(s=>s.id);
    const checkpoint:MissionCheckpoint={mission_state:pending.length?'in_progress':'ready_to_complete',
      current_step_id:pending[0]??null,completed_steps:completed,pending_steps:pending,
      results:[...context.checkpoint.results,{step_id:step,status:'passed',summary}],artifacts:[],
      test_evidence:[...context.checkpoint.test_evidence,`director-synthetic:${this.reviewedSha}:${this.slot}:${step}`],
      worktree:{branch:'director/synthetic-observation',sha:this.reviewedSha}};
    return {checkpoint,events:[],evidence:checkpoint.test_evidence};
  }
}

function directorClient(store:CloudMissionStore,grant:DirectorCloudGrant):SupabaseClient {
  const source=store.directorClient(grant) as unknown as SupabaseClient;
  const read=(name:string)=>async()=>{
    const result=await store.callDirectorSql(name,[grant.missionId,grant.binding,grant.reviewedSha,grant.slot,grant.authorizationId]);
    return JSON.parse(result);
  };
  const observe=read('director_observe_synthetic_agents');
  const status=read('director_read_mission');
  return Object.assign(Object.create(source),{
    directorObserve:observe,directorStatus:status,
  }) as SupabaseClient;
}

/** Host-only one-task runtime; no generic agent claim, admission, plan save, network or provider path. */
export async function runDirectorSyntheticMission(store:CloudMissionStore,rawGrant:unknown,signal?:AbortSignal):Promise<void> {
  const grant=validateDirectorGrant(rawGrant,store);
  const client=directorClient(store,grant) as SupabaseClient & {directorObserve:()=>Promise<AgentTaskObservation[]>;directorStatus:()=>Promise<any>};
  const base=createMissionLedger(client,[],25);
  const tokens=new WeakSet<object>();
  const executor=new DirectorSyntheticExecutor(client.directorObserve,grant.reviewedSha,grant.slot);
  const ledger:MissionLedger={...base,
    async authorizeExecutor(candidate) {
      if(candidate!==executor||candidate.executorId!==DIRECTOR_SYNTHETIC_EXECUTOR)throw Error('director_executor_mismatch');
      const state=await client.directorStatus();
      if(state?.no_send!=='true'||state?.no_dispatch!=='true')throw Error('director_authorization_denied');
    },
    async authorizeEffect(candidate,context,effect) {
      if(candidate!==executor||context.executorId!==executor.executorId||context.mission.missionId!==grant.missionId
        ||!['execute_step','write_checkpoint','fail','attest_completion','complete_write'].includes(effect.kind)
        ||!new RegExp(`^runtime:(?:execute|checkpoint|fail|attest|complete):${grant.missionId}:[a-zA-Z0-9._:-]{1,120}$`).test(effect.operationId))
        throw Error('director_effect_denied');
      return [];
    },
    async attestCompletion(candidate,context) {
      if(candidate!==executor||context.checkpoint.mission_state!=='ready_to_complete')throw Error('director_verification_failed');
      const saved=await client.directorStatus();
      if(saved?.no_send!=='true'||saved?.no_dispatch!=='true'||saved?.status!=='running'
        ||saved?.checkpoint_version!==context.checkpointVersion||stable(saved?.checkpoint)!==stable(context.checkpoint))
        throw Error('director_verification_failed');
      const first=context.checkpoint.results.find(r=>r.step_id==='observe-ledger');
      const second=context.checkpoint.results.find(r=>r.step_id==='verify-observation');
      let summary:unknown;try{summary=JSON.parse(first?.summary??'null');}catch{throw Error('director_verification_failed');}
      const digest=createHash('sha256').update(stable(summary)).digest('hex');
      if(!validateSummary(summary)||second?.summary!==`verified:${digest}:${grant.reviewedSha}:${grant.slot}`)
        throw Error('director_verification_failed');
      const token=Object.freeze({});tokens.add(token);return token;
    },
    async completeMission(context,evidence,attestation) {
      if(!attestation||typeof attestation!=='object'||!tokens.has(attestation))throw Error('director_verification_failed');
      tokens.delete(attestation);return base.completeMission(context,evidence,attestation);
    },
  };
  await new PersistentMissionOrchestrator(ledger,20_000).runMission(executor,'director',signal);
}

/** Existing PLAN Cloud handoff only. It never creates work and is inert until a protected host invokes it. */
export async function consumeDirectorSyntheticHandoff(
  handoff:CloudLedgerHandoff,store:CloudMissionStore,rawGrant:unknown,policy:CloudHandoffPolicy,
  signal?:AbortSignal,
):Promise<CloudHandoffReceipt> {
  const grant=validateDirectorGrant(rawGrant,store);
  const statusClient=directorClient(store,grant) as SupabaseClient & {directorStatus:()=>Promise<any>};
  const adapter={binding:store.binding,status:async(id:string)=>{
    if(id!==grant.missionId)throw Error('director_mission_denied');
    const s=await statusClient.directorStatus();
    return {id,queueState:s.status,state:s.checkpoint?.mission_state,reason:null,runId:null,
      leaseActive:s.lease_active,attempts:s.attempts,maxAttempts:3,checkpointVersion:s.checkpoint_version,
      planVersion:1,checkpoint:s.checkpoint,plans:[],audit:[],authorization:{active:s.no_send==='true'&&s.no_dispatch==='true',revision:s.authorization_revision,expiresAt:Date.parse(grant.expiresAt)}};
  }};
  return consumeCloudHandoff(handoff,{policy:()=>structuredClone(policy),store:adapter,
    resume:async(id,runSignal)=>{if(id!==grant.missionId)throw Error('director_mission_denied');await runDirectorSyntheticMission(store,grant,runSignal);},
    now:()=>Date.now()});
}
