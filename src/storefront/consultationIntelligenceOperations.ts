import { createHash } from 'node:crypto';
import { approvedConsultationFacts,currentFacts } from './consultationEvidence';
import { CONSULTATION_UUID } from './consultationRequest';
import { strictObject } from './consultationIntelligenceContracts';
export type WorkflowEvent={kind:string;key:string;payload:{occurredAt:string;consentReference?:string;sourceKey?:string;issue?:string;factId?:string}};
const kinds=['consent_recorded','opt_out','proposal_confirmed','session_confirmed','followup_proposed','learning_proposed'];
export function validateWorkflowEvent(value:unknown,now:Date):value is WorkflowEvent{
 if(!strictObject(value,['kind','key','payload'])||!kinds.includes(value.kind as string)||typeof value.key!=='string'||!/^[a-f0-9]{64}$/.test(value.key)||!value.payload||typeof value.payload!=='object'||Array.isArray(value.payload))return false;
 const payload=value.payload as Record<string,unknown>;
 if(Object.keys(payload).some(k=>!['occurredAt','consentReference','sourceKey','issue','factId'].includes(k))||typeof payload.occurredAt!=='string'||!Number.isFinite(Date.parse(payload.occurredAt))||Date.parse(payload.occurredAt)>now.getTime())return false;
 if(value.kind==='consent_recorded'&&(typeof payload.consentReference!=='string'||!CONSULTATION_UUID.test(payload.consentReference)))return false;
 if(payload.sourceKey!==undefined&&(typeof payload.sourceKey!=='string'||!/^[a-f0-9]{64}$/.test(payload.sourceKey)))return false;
 if(value.kind==='learning_proposed'&&(!['missing_fact','contradiction','wrong_interpretation'].includes(payload.issue as string)||!approvedConsultationFacts.some(f=>f.id===payload.factId)))return false;
 return Object.values(payload).every(v=>typeof v==='string'&&v.length<=100);
}
/** Proposals only; no retention extension, scheduler, channel integration or message delivery. */
export function prepareIntelligenceOperations(events:readonly WorkflowEvent[],now:Date){
 const sorted=[...events].filter(e=>Number.isFinite(Date.parse(e.payload.occurredAt))&&Date.parse(e.payload.occurredAt)<=+now).sort((a,b)=>Date.parse(a.payload.occurredAt)-Date.parse(b.payload.occurredAt)||(a.kind==='opt_out'?1:0)-(b.kind==='opt_out'?1:0));
 const lastPermission=sorted.filter(e=>['consent_recorded','opt_out'].includes(e.kind)).at(-1);
 const consent=lastPermission?.kind==='consent_recorded'&&!!lastPermission.payload.consentReference;
 const proposed=sorted.filter(e=>e.kind==='followup_proposed');
 const followups:{key:string;kind:'proposal'|'post_session';text:string;approvalRequired:true;sourceKey:string}[]=[];
 if(consent&&proposed.length<2){
  const due=sorted.filter(e=>e.kind==='proposal_confirmed'||e.kind==='session_confirmed').filter(e=>+now-Date.parse(e.payload.occurredAt)>=(e.kind==='proposal_confirmed'?48:24)*3600000&&!proposed.some(p=>p.payload.sourceKey===e.key)).at(-1);
  if(due){const kind=due.kind==='proposal_confirmed'?'proposal':'post_session';followups.push({key:createHash('sha256').update(due.key+'|followup-v1').digest('hex'),kind,
   text:kind==='proposal'?'Hola, ¿pudiste mirar la propuesta? Si tenés dudas, Victoria puede revisarlas con vos.\n\nVictoria | Victoriosas':'Hola, ¿cómo te sentiste después del encuentro? Tu respuesta queda para revisión personal de Victoria.\n\nVictoria | Victoriosas',approvalRequired:true,sourceKey:due.key});}
 }
 const facts=currentFacts(approvedConsultationFacts,now).facts;
 const content=facts.slice(0,3).map((f,index)=>({id:'content-v1-'+index,status:'draft' as const,text:f.fragment,factIds:[f.id],version:f.version,approvalRequired:true}));
 return {mode:'shadow' as const,followups,content,reactivationEnabled:false,reactivationReason:'La retención vigente de consultas es de 30 días. Un seguimiento a 60 días requiere otra base y política aprobadas.',consentRecorded:!!consent,learning:'Las correcciones solo generan propuestas; no cambian conocimiento ni políticas.'};
}
