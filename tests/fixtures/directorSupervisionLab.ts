/** Test-only loopback transport. NOT an application adapter or a cloud executor. */
import { execFile } from 'node:child_process';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createMissionLedger, PersistentMissionOrchestrator } from '../../src/autopilot/missionRuntime';
import { observeAgents, type AgentTaskObservation } from '../../src/autopilot/agentObservation';
import { AGENT_IDS } from '../../src/autopilot/sixAgentControlPlane';
import type { ExecutorAdapter, MissionCheckpoint } from '../../src/autopilot/executorAdapter';
import { CloudMissionStore, cloudBinding, type CloudMissionConfig } from '../../src/autopilot/cloudMissionStore';
import { ManagedProcesses } from '../../src/autopilot/managedProcesses';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const LAB_MISSION = 'synthetic-director-supervision';
export const literal = (value: unknown) => `'${(typeof value === 'object' ? JSON.stringify(value) : String(value)).replaceAll("'", "''")}'`;
export function labConnection() {
  const url = new URL(process.env.DIRECTOR_LAB_DATABASE_URL ?? 'invalid:');
  if (url.protocol !== 'postgresql:' || url.hostname !== '127.0.0.1'
    || url.pathname !== '/victoriosa_director_supervision_lab' || url.search || url.hash
    || !/^[a-z_][a-z0-9_]*$/.test(url.username) || !url.port) throw Error('disposable_loopback_lab_required');
  return url;
}
export function directorCloudStore() {
  const db=labConnection();
  const config:CloudMissionConfig={version:1,mode:'cloud_synthetic_lab',ledgerId:'synthetic-director-supervision-lab',
    database:{host:'127.0.0.1',port:Number(db.port),name:'victoriosa_director_supervision_lab',user:'autopilot_cloud_runner',
      sslRootCert:process.env.DIRECTOR_LAB_TLS_ROOT_CERT??'',passFile:process.env.DIRECTOR_LAB_RUNNER_PASSFILE??''},
    resources:{repository:process.cwd(),worktreeRoot:tmpdir(),baseSha:process.env.DIRECTOR_LAB_REVIEWED_SHA??'8892d2b10c204627b1b5efc661e8e052ef247cc7'},
    permissions:{admit:false,execute:true,cancel:false},leaseSeconds:25,deadlineMs:20000,queryTimeoutMs:5000};
  return {config,store:new CloudMissionStore(config,new ManagedProcesses()),binding:cloudBinding(config)};
}
export async function sql(query: string): Promise<string> {
  const url = labConnection();
  return new Promise((resolve, reject) => {
    const child = execFile(process.env.PSQL_PATH || 'psql', ['-h','127.0.0.1','-p',url.port,
      '-U',url.username,'-d','victoriosa_director_supervision_lab','-w','-X','-qAt','-v','ON_ERROR_STOP=1'], {
      timeout:10000, maxBuffer:262144,
      env:{PATH:process.env.PATH,PGPASSWORD:decodeURIComponent(url.password),PGCONNECT_TIMEOUT:'3',PGCLIENTENCODING:'UTF8'},
    }, (error, stdout) => error ? reject(Error('lab_sql_rejected')) : resolve(stdout.trim()));
    child.stdin!.end(`set statement_timeout=5000; set request.jwt.claim.role='service_role';\n${query}`);
  });
}
export async function readAgents() {
  const records = JSON.parse(await sql(`select coalesce(json_agg(r),'[]') from
    (select id,agent_id,status,attempt_count,updated_at,lease_until,completed_evidence
     from public.agent_tasks where actor='synthetic-supervision-lab' order by id limit 500) r;`)) as AgentTaskObservation[];
  return observeAgents(records,new Date());
}
export function labClient(injectAuditFailure = false): SupabaseClient {
  const parameters: Record<string,string[]> = {
    six_agent_claim_mission:['p_agent','p_lease_seconds'],
    six_agent_checkpoint:['p_task_id','p_mission_id','p_token','p_checkpoint_version','p_operation_id','p_executor_id','p_checkpoint'],
    six_agent_complete:['p_task_id','p_token','p_evidence'],
    six_agent_fail:['p_task_id','p_token','p_reason'],
  };
  return {rpc:async (name:string,args:Record<string,unknown>) => {
    if (!Object.hasOwn(parameters,name)) throw Error('lab_rpc_denied');
    if (name === 'six_agent_claim_mission' ? args.p_agent !== 'director' : args.p_task_id !== LAB_MISSION)
      throw Error('lab_scope_denied');
    // Short real lease only in this disposable fixture; production defaults stay unchanged.
    const values = parameters[name].map(key => `${key}=>${literal(key==='p_lease_seconds'?5:args[key])}${key==='p_checkpoint'?'::jsonb':''}`).join(',');
    const call = `public.${name}(${values})`;
    try {
      const data = await sql(`begin;
        do $$ begin if not exists(select 1 from public.director_lab_guard where no_send=true)
          then raise exception 'unbound_lab'; end if; end $$;
        ${injectAuditFailure && name==='six_agent_checkpoint' && args.p_checkpoint_version===2 ? "set local test.reject_director_audit='on';" : ''}
        select ${name==='six_agent_claim_mission'?`coalesce(json_agg(c),'[]'::json) from ${call} c`:`to_json(${call})`}; commit;`);
      return {data:JSON.parse(data),error:null};
    } catch {return {data:null,error:{message:'lab_rpc_failed'}};}
  }} as unknown as SupabaseClient;
}

/** Reuses the existing runtime. Can only observe synthetic rows and validate a saved observation. */
export async function runLabCycle(injectAuditFailure = false) {
  const steps: string[] = [];
  const executor: ExecutorAdapter = {executorId:'director-supervision-lab',execute:async context => {
    if (context.mission.missionId !== LAB_MISSION
      || JSON.stringify(context.mission.restrictions)!==JSON.stringify(['synthetic_only','no_send','no_dispatch']))
      throw Error('lab_mission_denied');
    const next = context.checkpoint.current_step_id;
    if (!['observe-ledger','verify-observation'].includes(next ?? '')) throw Error('lab_step_denied');
    steps.push(next!);
    let summary: string;
    if (next==='observe-ledger') {
      const agents = await readAgents();
      if (JSON.stringify(agents.map(a=>a.id))!==JSON.stringify(AGENT_IDS)) throw Error('canonical_agents_missing');
      summary=JSON.stringify({noSend:true,agents:agents.map(a=>({id:a.id,runtimeStatus:a.runtimeStatus}))});
    } else {
      const saved = JSON.parse(context.checkpoint.results.find(r=>r.step_id==='observe-ledger')?.summary ?? 'null');
      if (saved?.noSend!==true || JSON.stringify(saved.agents?.map((a:{id:string})=>a.id))!==JSON.stringify(AGENT_IDS))
        throw Error('durable_observation_missing');
      summary='six_roles_observed_no_execution_attested';
    }
    const completed = [...context.checkpoint.completed_steps,next!];
    const pending = context.mission.plan.filter(s=>!completed.includes(s.id)).map(s=>s.id);
    const checkpoint: MissionCheckpoint = {mission_state:pending.length?'in_progress':'ready_to_complete',
      current_step_id:pending[0]??null,completed_steps:completed,pending_steps:pending,
      results:[...context.checkpoint.results,{step_id:next!,status:'passed',summary}],
      artifacts:[],test_evidence:[...context.checkpoint.test_evidence,`synthetic:${next}:no_send`],
      worktree:{branch:'test/director-supervision',sha:'synthetic-no-code-effects'}};
    return {checkpoint,events:[],evidence:checkpoint.test_evidence};
  }};
  // No cloud wiring, scheduler or generic executor registry. This fixture owns its disposable DB.
  await new PersistentMissionOrchestrator(createMissionLedger(labClient(injectAuditFailure)),15000).runMission(executor,'director');
  return {noSend:true,steps,commercialActions:0,schedulerCreated:false};
}

if (process.argv[2]==='director-lab-worker') {
  runLabCycle(process.argv[3]==='inject-audit-failure')
    .then(receipt=>console.log(JSON.stringify(receipt)))
    .catch(()=>{console.error('synthetic_cycle_interrupted');process.exitCode=1;});
}
