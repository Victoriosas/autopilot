/** Fail-closed six-agent control plane. No network, billing, messages or production writes. */
export const AGENT_IDS = ['director','software','infrastructure','consultations','followup','reports'] as const;
export type AgentId = typeof AGENT_IDS[number];
export type AgentState = 'ready'|'paused'|'degraded';
export type TaskState = 'pending'|'running'|'completed'|'blocked'|'failed';
export interface ControlTask { id:string; agent:AgentId; kind:string; state:TaskState; attempts:number; maxAttempts:number; nextRunAt:string; lockUntil?:string; lastError?:string; evidence?:string }
export interface ControlAgent { id:AgentId; state:AgentState; trigger:string; autonomous:boolean }
export const SIX_AGENTS:readonly ControlAgent[] = [
  {id:'director',state:'ready',trigger:'enqueue / scheduled poll',autonomous:true},
  {id:'software',state:'ready',trigger:'pull_request / issue / explicit task',autonomous:false},
  {id:'infrastructure',state:'ready',trigger:'scheduled health check / deployment event',autonomous:true},
  {id:'consultations',state:'degraded',trigger:'authorized inbound consultation',autonomous:false},
  {id:'followup',state:'ready',trigger:'scheduled authorized state review',autonomous:false},
  {id:'reports',state:'ready',trigger:'daily / weekly schedule',autonomous:true},
];
export function validateTask(task:ControlTask):void {
 if(!/^[a-zA-Z0-9:_-]{8,128}$/.test(task.id)||!AGENT_IDS.includes(task.agent)||!Number.isInteger(task.attempts)||task.attempts<0||!Number.isInteger(task.maxAttempts)||task.maxAttempts<1||task.maxAttempts>5||!Number.isFinite(Date.parse(task.nextRunAt)))throw Error('invalid_task');
}
export function claimTask(task:ControlTask, now:Date, leaseMs=60_000):ControlTask|null {
 validateTask(task);
 if(leaseMs<1_000||leaseMs>300_000)throw Error('invalid_lease');
 if(!['pending','failed','running'].includes(task.state)||task.attempts>=task.maxAttempts||Date.parse(task.nextRunAt)>+now)return null;
 if(task.state==='running'&&(!task.lockUntil||Date.parse(task.lockUntil)>+now))return null;
 if(SIX_AGENTS.find(a=>a.id===task.agent)?.state!=='ready')return null;
 return {...task,state:'running',attempts:task.attempts+1,lockUntil:new Date(+now+leaseMs).toISOString()};
}
export function finishTask(task:ControlTask, evidence:string):ControlTask {
 if(task.state!=='running'||!evidence.trim())throw Error('evidence_required');
 return {...task,state:'completed',evidence,lockUntil:undefined};
}
export function failTask(task:ControlTask, reason:string, now:Date):ControlTask {
 if(task.state!=='running'||!reason.trim())throw Error('failure_reason_required');
 const terminal=task.attempts>=task.maxAttempts;
 const delay=Math.min(3_600_000,30_000*2**Math.max(0,task.attempts-1));
 return {...task,state:terminal?'blocked':'failed',lastError:reason.slice(0,160),lockUntil:undefined,nextRunAt:new Date(+now+delay).toISOString()};
}
export function classifyConsultation(message:string):'human_review'|'general_information' {
 const normalized=message.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(!normalized.trim()||normalized.length>4000||/(embaraz|medicament|alerg|diagnostic|enfermedad|dolor|lesion|contraindic|sangr|acne severo|tratamiento medico|menor de edad|precio|tarifa|turno|horario|disponibilidad|cuanto|cuesta|costo|valor)/.test(normalized))return 'human_review';
 return 'general_information';
}
export function consultationDecision(message:string, consent:boolean, deliveryApproved:boolean){
 const category=classifyConsultation(message);
 return {category, canAutoSend:false, reason:!consent?'consent_required':!deliveryApproved?'delivery_disabled':'human_approval_required', reviewRequired:true};
}
export function summarizeControl(tasks:readonly ControlTask[]) {
 return SIX_AGENTS.map(agent=>({id:agent.id,state:agent.state,trigger:agent.trigger,
 pending:tasks.filter(t=>t.agent===agent.id&&['pending','failed'].includes(t.state)).length,
 completed:tasks.filter(t=>t.agent===agent.id&&t.state==='completed'&&Boolean(t.evidence)).length,
 blocked:tasks.filter(t=>t.agent===agent.id&&t.state==='blocked').length}));
}
