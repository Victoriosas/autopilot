import { diagnosePublicHealth } from './publicHealthDiagnostic.ts';

export const CLOUD_ROLES = ['software','infrastructure','consultations','followup','reports'] as const;
export interface CloudClaim {task_id:string;claim_token:string;agent:string}
export type CloudRpc = (name:string,args:Record<string,unknown>)=>Promise<unknown>;
export interface CloudRuntimeConfig {
  enabled:boolean; reviewedSha:string; artifactSha:string;
  rpc:CloudRpc; health?:typeof diagnosePublicHealth;
}
function claim(value:unknown,agent:string):CloudClaim|null {
 if(value===null)return null;
 const c=value as CloudClaim;
 if(!c||typeof c.task_id!=='string'||!/^cloud-v3:[0-9]+:[a-z]+$/.test(c.task_id)
  ||!c.task_id.endsWith(':'+agent)||c.agent!==agent
  ||typeof c.claim_token!=='string'||!/^[0-9a-f-]{36}$/.test(c.claim_token))throw Error('invalid_cloud_claim');
 return c;
}
/** Bounded one-cycle executor. No timers, queue, model, shell or arbitrary input. */
export async function runCloudOffice(config:CloudRuntimeConfig) {
 if(!config.enabled)throw Error('cloud_runtime_disabled');
 if(!/^[0-9a-f]{40}$/.test(config.reviewedSha)||config.artifactSha!==config.reviewedSha)throw Error('unreviewed_artifact');
 const common={p_sha:config.reviewedSha};
 const director=claim(await config.rpc('cloud_v3_start',common),'director');
 if(!director)return {state:'no_eligible_task',tasksClaimed:0,noSend:true};
 let tasksClaimed=1;
 for(const agent of CLOUD_ROLES){
  const task=claim(await config.rpc('cloud_v3_claim',{...common,p_parent:director.task_id,p_token:director.claim_token,p_agent:agent}),agent);
  if(!task)continue; // SQL decides deduplication, retry and ownership.
  if(task.task_id!==director.task_id.replace(/:director$/,':'+agent))throw Error('unrelated_cloud_claim');
  tasksClaimed++;
  let result:unknown;
  if(agent==='infrastructure')result=await (config.health??diagnosePublicHealth)();
  else if(agent==='software')result={kind:'artifact_verified',sha:config.artifactSha};
  else result=await config.rpc('cloud_v3_measure',{...common,p_id:task.task_id,p_token:task.claim_token});
  if(await config.rpc('cloud_v3_finish',{...common,p_id:task.task_id,p_token:task.claim_token,p_result:result})!==true)throw Error('cloud_completion_fenced');
 }
 if(await config.rpc('cloud_v3_finish',{...common,p_id:director.task_id,p_token:director.claim_token,p_result:{}})!==true)throw Error('cloud_completion_fenced');
 // A persisted failure is an execution, never silently advertised as success.
 return {state:'cycle_recorded',tasksClaimed,noSend:true};
}

const RPCS=new Set(['cloud_v3_start','cloud_v3_claim','cloud_v3_measure','cloud_v3_finish','cloud_v3_status']);
export function cloudRpcClient(config:{url:string;apiKey:string;jwt:string;fetcher?:typeof fetch}):CloudRpc {
 const url=new URL(config.url);
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('cloud_transport_config_invalid');
 if(!config.apiKey||!config.jwt)throw Error('cloud_transport_config_invalid');
 return async(name,args)=>{
  if(!RPCS.has(name))throw Error('cloud_rpc_denied');
  const r=await (config.fetcher??fetch)(new URL('/rest/v1/rpc/'+name,url),{method:'POST',redirect:'error',
   headers:{apikey:config.apiKey,authorization:'Bearer '+config.jwt,'content-type':'application/json'},
   body:JSON.stringify(args),signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw Error('cloud_rpc_rejected');
  return r.json();
 };
}
