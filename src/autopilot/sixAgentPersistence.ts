import type { SupabaseClient } from '@supabase/supabase-js';
import { AGENT_IDS, type AgentId } from './sixAgentControlPlane';
import type { MissionCheckpoint } from './executorAdapter';

/** Server-only adapter. Use a service-role Supabase client; never import into browser code.
 * Database functions enforce token ownership and atomic SKIP LOCKED claims.
 */
export interface ClaimedAgentTask { task_id:string; claim_token:string; task_payload:Record<string,unknown> }
function isRecord(value:unknown):value is Record<string,unknown> {
 return typeof value==='object'&&value!==null&&!Array.isArray(value);
}
export async function claimPersistedTask(client:SupabaseClient, agent:AgentId):Promise<ClaimedAgentTask|null> {
 if(!AGENT_IDS.includes(agent)) throw new Error('invalid_agent');
 const {data,error}=await client.rpc('six_agent_claim',{p_agent:agent,p_lease_seconds:60});
 if(error) throw new Error('claim_failed');
 const claims=data as ClaimedAgentTask[]|null;
 return claims?.[0]??null;
}
export async function completePersistedTask(client:SupabaseClient, task:ClaimedAgentTask, evidence:string):Promise<void> {
 if(!evidence.trim())throw new Error('evidence_required');
 const {data,error}=await client.rpc('six_agent_complete',{p_task_id:task.task_id,p_token:task.claim_token,p_evidence:evidence});
 if(error||data!==true)throw new Error('completion_rejected');
}
export async function failPersistedTask(client:SupabaseClient, task:ClaimedAgentTask, reasonCode:string):Promise<void> {
 if(!/^[a-z][a-z0-9_]{2,63}$/.test(reasonCode))throw new Error('reason_code_required');
 const {data,error}=await client.rpc('six_agent_fail',{p_task_id:task.task_id,p_token:task.claim_token,p_reason:reasonCode});
 if(error||data!==true)throw new Error('failure_rejected');
}
export async function saveMissionCheckpoint(
 client:SupabaseClient,
 task:ClaimedAgentTask,
 checkpointVersion:number,
 operationId:string,
 executorId:string,
 checkpoint:MissionCheckpoint,
):Promise<boolean> {
 const autopilot=task.task_payload.__autopilot;
 if(!isRecord(autopilot))throw new Error('mission_context_missing');
 const missionId=autopilot.mission_id;
 if(typeof missionId!=='string'||!missionId)throw new Error('mission_context_missing');
 const {data,error}=await client.rpc('six_agent_checkpoint',{
  p_task_id:task.task_id,
  p_mission_id:missionId,
  p_token:task.claim_token,
  p_checkpoint_version:checkpointVersion,
  p_operation_id:operationId,
  p_executor_id:executorId,
  p_checkpoint:checkpoint,
 });
 if(error)throw new Error('checkpoint_write_failed');
 return data===true;
}
