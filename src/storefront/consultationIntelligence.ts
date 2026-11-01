import { createHash } from 'node:crypto';
import type { ConsultationRecord } from './consultationSupabase';
import { approvedConsultationFacts,currentFacts,type ConsultationFact } from './consultationEvidence';
import { understandConsultation } from './consultationUnderstanding';
import { INTELLIGENCE_VERSION,intelligenceSchemas,strictObject,validateModelUnderstanding,type ConsultationModel } from './consultationIntelligenceContracts';

export const intelligencePolicy=Object.freeze({version:'shadow-policy-v1',level:0,shadow:true,maxCalls:3,timeoutMs:8000,maxInputBytes:12000,maxOutputBytes:16000,approvalTtlMs:15*60000});
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const conversationVersion=(record:ConsultationRecord)=>hash({id:record.id,input:record.input,expiresAt:record.expires_at});
export type GuardianResult={status:'approved'|'requires_changes'|'blocked';codes:string[]};
const hello=['Hola, gracias por escribirnos.','Hola, gracias por tu consulta.','Hola, te compartimos la información disponible.'];
const pending='Quedan preguntas pendientes de revisión por Victoria; no tenemos información aprobada suficiente para responderlas.';
const signature='Victoria | Victoriosas';
export type IntelligenceAnalysis={
 version:string;mode:'shadow';conversationVersion:string;knowledgeVersion:string;policyVersion:string;createdAt:string;expiresAt:string;
 provider:{id:string;model:string;configVersion:string};understanding:ReturnType<typeof understandConsultation>;
 evidence:ConsultationFact[];unanswered:string[];drafts:{id:string;title:string;text:string;factIds:string[]}[];
 guardian:GuardianResult;decision:{level:0;action:'no_send';codes:string[]};fingerprint:string;statistics:{calls:number;latencyMs:number};
};
const knowledgeVersion=(facts:readonly ConsultationFact[])=>hash(facts);
export async function analyzeConsultation(record:ConsultationRecord,options:{now?:Date;facts?:readonly ConsultationFact[];provider?:ConsultationModel;reserveBudget?:()=>Promise<boolean>}={}):Promise<IntelligenceAnalysis>{
 const started=Date.now(),now=options.now??new Date(),facts=options.facts??approvedConsultationFacts;
 const understanding=understandConsultation(record.input),codes:string[]=[];
 const current=currentFacts(facts,now),evidence:ConsultationFact[]=[],unanswered:string[]=[];
 if(current.conflicts.length)codes.push('KNOWLEDGE_CONFLICT');
 for(const question of understanding.questions){
  const match=current.facts.find(f=>f.topic===question.topic&&(f.topic!=='service'||understanding.serviceCandidates.length===1&&f.service===understanding.serviceCandidates[0]));
  if(match&&!evidence.some(f=>f.id===match.id))evidence.push(match);
  if(!match)unanswered.push(question.id);
 }
 if(!evidence.length)codes.push('EVIDENCE_INSUFFICIENT');
 if(understanding.risks.length)codes.push(...understanding.risks.map(r=>'RISK_'+r.toUpperCase()));
 if(Date.parse(record.expires_at)<=now.getTime()||!record.input.consent)codes.push('CONVERSATION_EXPIRED_OR_NO_CONSENT');
 if(understanding.questions.some(q=>q.topic==='unknown'))codes.push('CLARIFICATION_REQUIRED');
 const texts=hello.map(greeting=>greeting+'\n\n'+evidence.map(f=>f.fragment).join('\n\n')+(unanswered.length?'\n\n'+pending:'')+'\n\n'+signature);
 let calls=0;
 const provider=options.provider;
 if(provider){
  try{
   if(record.input.aiConsent!==true)throw Error('AI_CONSENT_REQUIRED');
   if(Date.parse(record.expires_at)<=now.getTime()||!record.input.consent)throw Error('CONVERSATION_EXPIRED_OR_NO_CONSENT');
   // Only minimized, non-sensitive messages may reach an explicitly authorized provider.
   if(understanding.risks.length)throw Error('RISK_REQUIRES_LOCAL_REVIEW');
   if(provider.remote&&(!options.reserveBudget||!await options.reserveBudget()))throw Error('BUDGET_UNAVAILABLE');
   let message=record.input.message.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g,'[correo]').replace(/\+?\d[\d ()-]{6,}\d/g,'[numero]');
   for(const value of [record.input.fullName,record.input.email,record.input.phone])if(value)message=message.replace(new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),'[dato de contacto]');
   const invoke=async(stage:'understand'|'draft'|'review',payload:unknown)=>{
    if(++calls>intelligencePolicy.maxCalls||new TextEncoder().encode(JSON.stringify(payload)).byteLength>intelligencePolicy.maxInputBytes)throw Error('MODEL_LIMIT');
    const signal=AbortSignal.timeout(intelligencePolicy.timeoutMs);
    const value=await Promise.race([provider.complete(stage,payload,intelligenceSchemas[stage],signal),new Promise<never>((_,reject)=>{signal.addEventListener('abort',()=>reject(Error('MODEL_TIMEOUT')),{once:true});})]);
    if(new TextEncoder().encode(JSON.stringify(value)??'').byteLength>intelligencePolicy.maxOutputBytes)throw Error('MODEL_OUTPUT_INVALID');
    return value;
   };
   const interpreted=validateModelUnderstanding(await invoke('understand',{untrustedMessage:message,serviceCandidates:understanding.serviceCandidates}));
   // The model may add concerns; it cannot remove deterministic risks or grant roles.
   if(interpreted.risks.length||interpreted.topics.some(t=>!understanding.questions.some(q=>q.topic===t))||understanding.questions.some(q=>!interpreted.topics.includes(q.topic))||interpreted.serviceCandidates.some(s=>!understanding.serviceCandidates.includes(s)))codes.push('MODEL_DISAGREEMENT_REVIEW');
   const generated=await invoke('draft',{evidence:evidence.map(f=>({id:f.id,version:f.version,fragment:f.fragment})),allowedDrafts:texts});
   if(!strictObject(generated,['texts'])||!Array.isArray(generated.texts)||generated.texts.length!==3||generated.texts.some((text,index)=>text!==texts[index]))codes.push('MODEL_UNSUPPORTED_TEXT');
   const reviewed=await invoke('review',{drafts:texts,evidence:evidence.map(f=>({id:f.id,fragment:f.fragment}))});
   if(!strictObject(reviewed,['status','codes'])||reviewed.status!=='approved'||!Array.isArray(reviewed.codes)||reviewed.codes.length)codes.push('MODEL_REVIEW_NOT_APPROVED');
  }catch{codes.push('MODEL_UNAVAILABLE_OR_INVALID');}
 }
 const guardian:GuardianResult={status:codes.length?'blocked':'approved',codes:[...new Set(codes)]};
 const result:IntelligenceAnalysis={version:INTELLIGENCE_VERSION,mode:'shadow',conversationVersion:conversationVersion(record),knowledgeVersion:knowledgeVersion(facts),policyVersion:intelligencePolicy.version,
 createdAt:now.toISOString(),expiresAt:new Date(Math.min(Date.parse(record.expires_at),now.getTime()+intelligencePolicy.approvalTtlMs)).toISOString(),
 provider:provider?{id:provider.id,model:provider.model,configVersion:provider.configVersion}:{id:'deterministic',model:'approved-extracts',configVersion:INTELLIGENCE_VERSION},
 understanding,evidence,unanswered,drafts:texts.map((text,i)=>({id:['personalizada','breve','orientacion'][i],title:['Personalizada','Breve','Orientación inicial'][i],text,factIds:evidence.map(f=>f.id)})),
 guardian,decision:{level:0,action:'no_send',codes:['SHADOW_MODE',...guardian.codes]},fingerprint:'',statistics:{calls,latencyMs:Date.now()-started}};
 result.fingerprint=hash({version:result.version,conversation:result.conversationVersion,knowledge:result.knowledgeVersion,policy:result.policyVersion,provider:result.provider,drafts:result.drafts});
 return result;
}
export function checkExactAnswer(analysis:IntelligenceAnalysis,record:ConsultationRecord,text:string,now=new Date(),facts:readonly ConsultationFact[]=approvedConsultationFacts):GuardianResult{
 const codes=[...analysis.guardian.codes];
 if(analysis.guardian.status!=='approved')codes.push('GUARDIAN_NOT_APPROVED');
 if(analysis.version!==INTELLIGENCE_VERSION||analysis.policyVersion!==intelligencePolicy.version||analysis.knowledgeVersion!==knowledgeVersion(facts))codes.push('VERSION_STALE');
 if(analysis.conversationVersion!==conversationVersion(record))codes.push('CONVERSATION_CHANGED');
 if(Date.parse(analysis.expiresAt)<=now.getTime()||Date.parse(record.expires_at)<=now.getTime())codes.push('APPROVAL_EXPIRED');
 if(!analysis.drafts.some(d=>d.text===text))codes.push('UNSUPPORTED_EDIT');
 if(!record.input.consent)codes.push('CONSENT_MISSING');
 const current=currentFacts(facts,now);
 if(current.conflicts.length||analysis.evidence.some(f=>!current.facts.some(v=>v.id===f.id&&v.version===f.version&&v.fragment===f.fragment)))codes.push('EVIDENCE_STALE');
 return {status:codes.length?'blocked':'approved',codes:[...new Set(codes)]};
}
export const approvalFingerprint=(analysis:IntelligenceAnalysis,record:ConsultationRecord,text:string)=>hash({run:analysis.fingerprint,conversation:conversationVersion(record),text,recipient:record.input.email,channel:record.input.responseChannel});
