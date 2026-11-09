import test from 'node:test'; import assert from 'node:assert/strict';
import {claimPersistedTask,completePersistedTask,failPersistedTask,saveMissionCheckpoint} from './sixAgentPersistence';
function mock(result:any){const calls:any[]=[];return {calls, client:{rpc:async (name:string,args:any)=>{calls.push({name,args});return result}} as any}}
test('claim uses atomic stored procedure and returns token',async()=>{const m=mock({data:[{task_id:'a',claim_token:'token',task_payload:{}}],error:null});assert.equal((await claimPersistedTask(m.client,'director'))?.task_id,'a');assert.equal(m.calls[0].name,'six_agent_claim')});
test('empty queue has no work',async()=>assert.equal(await claimPersistedTask(mock({data:[],error:null}).client,'director'),null));
test('database failures fail closed',async()=>assert.rejects(()=>claimPersistedTask(mock({error:{message:'offline'},data:null}).client,'director'),/claim_failed/));
test('completion requires evidence and exact claim',async()=>{const task={task_id:'a',claim_token:'token',task_payload:{}};await assert.rejects(()=>completePersistedTask(mock({data:true,error:null}).client,task,''),/evidence_required/);await assert.rejects(()=>completePersistedTask(mock({data:false,error:null}).client,task,'verified'),/completion_rejected/)});
test('failure records reason codes only',async()=>{const task={task_id:'a',claim_token:'token',task_payload:{}};await assert.rejects(()=>failPersistedTask(mock({data:true,error:null}).client,task,'client message contains PII'),/reason_code_required/);const m=mock({data:true,error:null});await failPersistedTask(m.client,task,'provider_unavailable');assert.equal(m.calls[0].args.p_reason,'provider_unavailable')});
test('mission checkpoint uses the durable claim mission identity and fencing token',async()=>{
 const task={task_id:'mission-001',claim_token:'claim-token',task_payload:{__autopilot:{mission_id:'mission-001'}}};
 const checkpoint={mission_state:'in_progress' as const,current_step_id:'step-1',completed_steps:[],pending_steps:['step-1'],results:[],artifacts:[],test_evidence:[],worktree:{branch:'test/mission',sha:'synthetic-sha'}};
 const m=mock({data:true,error:null});
 assert.equal(await saveMissionCheckpoint(m.client,task,1,'operation-0001','test-executor',checkpoint),true);
 assert.deepEqual(m.calls[0],{name:'six_agent_checkpoint',args:{
  p_task_id:'mission-001',p_mission_id:'mission-001',p_token:'claim-token',
  p_checkpoint_version:1,p_operation_id:'operation-0001',p_executor_id:'test-executor',p_checkpoint:checkpoint,
 }});
 const rejected=mock({data:false,error:null});
 assert.equal(await saveMissionCheckpoint(rejected.client,task,2,'operation-0002','test-executor',checkpoint),false);
});
test('mission checkpoint requires returned mission identity and reports database errors',async()=>{
 const checkpoint={mission_state:'in_progress' as const,current_step_id:'step-1',completed_steps:[],pending_steps:['step-1'],results:[],artifacts:[],test_evidence:[],worktree:{branch:'test/mission',sha:'synthetic-sha'}};
 await assert.rejects(()=>saveMissionCheckpoint(mock({data:true,error:null}).client,
  {task_id:'task-001',claim_token:'claim-token',task_payload:{}},1,'operation-0001','test-executor',checkpoint),/mission_context_missing/);
 await assert.rejects(()=>saveMissionCheckpoint(mock({data:null,error:{message:'offline'}}).client,
  {task_id:'mission-001',claim_token:'claim-token',task_payload:{__autopilot:{mission_id:'mission-001'}}},
  1,'operation-0001','test-executor',checkpoint),/checkpoint_write_failed/);
});
