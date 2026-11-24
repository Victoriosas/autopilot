import {cloudRpcClient} from './cloudRuntimeV3';
import {AGENT_IDS} from './sixAgentControlPlane';

export interface CloudStatusRow {id:string;pending:number;running:number;blocked:number;completed:number;lastHeartbeat:string|null;results:number;
 lastResult:{kind:string;count:number|null;code:string|null;sha:string;ok:boolean}|null}
export interface CloudStatus {source:'supabase';scope:'cloud_v3_read_only';environment:'isolated'|'production'|'unconfigured';generatedAt:string;partial:false;agents:CloudStatusRow[]}
/** Explicit destination and reader JWT only. No production/service-key fallback. */
export async function readCloudStatus(env:NodeJS.ProcessEnv=process.env):Promise<CloudStatus> {
 if(!env.AUTOPILOT_STATUS_URL||!env.AUTOPILOT_STATUS_API_KEY||!env.AUTOPILOT_STATUS_READER_JWT)throw Error('DIRECTOR_SYNTHETIC_READER_NOT_CONFIGURED');
 const data=await cloudRpcClient({url:env.AUTOPILOT_STATUS_URL,apiKey:env.AUTOPILOT_STATUS_API_KEY,jwt:env.AUTOPILOT_STATUS_READER_JWT})('cloud_v3_status',{}) as CloudStatus;
 if(data?.source!=='supabase'||data.scope!=='cloud_v3_read_only'||data.partial!==false||!['isolated','production','unconfigured'].includes(data.environment)
  ||!Number.isFinite(Date.parse(data.generatedAt))||Date.parse(data.generatedAt)>Date.now()+30000
  ||!Array.isArray(data.agents)||data.agents.length!==6)throw Error('CLOUD_STATUS_INVALID');
 const ids=new Set<string>();
 for(const a of data.agents){
  if(!AGENT_IDS.includes(a.id as typeof AGENT_IDS[number])||ids.has(a.id))throw Error('CLOUD_STATUS_INVALID');
  ids.add(a.id);
  for(const k of ['pending','running','blocked','completed','results'] as const)if(!Number.isSafeInteger(a[k])||a[k]<0)throw Error('CLOUD_STATUS_INVALID');
  if(a.lastHeartbeat!==null&&(!Number.isFinite(Date.parse(a.lastHeartbeat))||Date.parse(a.lastHeartbeat)>Date.parse(data.generatedAt)))throw Error('CLOUD_STATUS_INVALID');
  const r=a.lastResult;
  if(r!==null&&(!r||!['artifact_verified','public_health','consultations_aggregate','followup_aggregate','reports_aggregate','office_cycle'].includes(r.kind)
    ||(r.count!==null&&(!Number.isSafeInteger(r.count)||r.count<0))
    ||(r.code!==null&&!['ok','dns','tls','timeout','http','unexpected_content','network'].includes(r.code))
    ||typeof r.sha!=='string'||!/^[0-9a-f]{40}$/.test(r.sha)||typeof r.ok!=='boolean'))throw Error('CLOUD_STATUS_INVALID');
 }
 // Reconstruct only the safe projection, discarding unexpected upstream fields.
 return {source:'supabase',scope:'cloud_v3_read_only',environment:data.environment,generatedAt:data.generatedAt,partial:false,
  agents:data.agents.map(a=>({id:a.id,pending:a.pending,running:a.running,blocked:a.blocked,completed:a.completed,lastHeartbeat:a.lastHeartbeat,results:a.results,
   lastResult:a.lastResult===null?null:{kind:a.lastResult.kind,count:a.lastResult.count,code:a.lastResult.code,sha:a.lastResult.sha,ok:a.lastResult.ok}}))};
}
