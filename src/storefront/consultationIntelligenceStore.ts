import { beautyServerDatabase } from './beautyDatabase';
import type { ConsultationRecord } from './consultationSupabase';
import { analyzeConsultation,approvalFingerprint,checkExactAnswer,conversationVersion,intelligencePolicy,type IntelligenceAnalysis } from './consultationIntelligence';
import { INTELLIGENCE_VERSION,type ConsultationModel } from './consultationIntelligenceContracts';
export type IntelligenceClaim={state:'claimed'|'busy'|'ready'|'failed';id?:string;lease?:string;analysis?:IntelligenceAnalysis};
export interface IntelligenceStore{
 claim(request:string,version:string,config:string):Promise<IntelligenceClaim>;
 finish(id:string,lease:string,analysis:IntelligenceAnalysis):Promise<boolean>;
 get(request:string,id:string):Promise<{id:string;analysis:IntelligenceAnalysis}|null>;
 review(request:string,id:string,admin:string,text:string,fingerprint:string,action:'approve'|'reject'):Promise<boolean>;
 reserve(id:string,amount:number,daily:number,monthly:number):Promise<boolean>;
 report():Promise<Record<string,unknown>>;
}
export function createIntelligenceStore(database=beautyServerDatabase):IntelligenceStore{
 const rpc=async(name:string,params:Record<string,unknown>)=>{const r=await database().rpc(name,params);if(r.error)throw Error('INTELLIGENCE_STORE_UNAVAILABLE');return r.data;};
 return {
  claim:(request,version,config)=>rpc('consultation_ai_claim',{p_request:request,p_version:version,p_config:config}),
  finish:(id,lease,analysis)=>rpc('consultation_ai_finish',{p_run:id,p_lease:lease,p_analysis:analysis}),
  async get(request,id){const r=await database().from('consultation_intelligence_runs').select('id,analysis').eq('request_id',request).eq('id',id).not('analysis','is',null).maybeSingle();if(r.error)throw Error('INTELLIGENCE_STORE_UNAVAILABLE');return r.data as any;},
  review:(request,id,admin,text,fingerprint,action)=>rpc('consultation_ai_review',{p_request:request,p_run:id,p_admin:admin,p_text:text,p_hash:fingerprint,p_action:action}),
  reserve:(id,amount,daily,monthly)=>rpc('consultation_ai_reserve_budget',{p_run:id,p_amount:amount,p_daily:daily,p_monthly:monthly}),
  report:()=>rpc('consultation_ai_report',{}),
 };
}
export const intelligenceStore=createIntelligenceStore();
export async function runConsultationIntelligence(record:ConsultationRecord,options:{store?:IntelligenceStore;provider?:ConsultationModel;now?:Date;dailyBudget?:number;monthlyBudget?:number}={}){
 const store=options.store??intelligenceStore,provider=options.provider;
 const config=[INTELLIGENCE_VERSION,intelligencePolicy.version,provider?.id??'local',provider?.model??'approved-extracts',provider?.configVersion??INTELLIGENCE_VERSION].join('/');
 const version=conversationVersion(record),claim=await store.claim(record.id,version,config);
 if(claim.state==='ready'){
  if(!claim.analysis||claim.analysis.conversationVersion!==version||Date.parse(claim.analysis.expiresAt)<(options.now??new Date()).getTime())throw Error('INTELLIGENCE_RESULT_STALE');
  return {state:'ready' as const,id:claim.id,analysis:claim.analysis};
 }
 if(claim.state!=='claimed'||!claim.id||!claim.lease)return {state:claim.state,id:claim.id};
 const analysis=await analyzeConsultation(record,{now:options.now,provider,reserveBudget:()=>store.reserve(claim.id!,50000,options.dailyBudget??0,options.monthlyBudget??0)});
 if(!await store.finish(claim.id,claim.lease,analysis))throw Error('INTELLIGENCE_RESULT_STALE');
 return {state:'ready' as const,id:claim.id,analysis};
}
export async function reviewConsultationIntelligence(record:ConsultationRecord,run:string,admin:string,text:string,options:{store?:IntelligenceStore;now?:Date;action?:'approve'|'reject'}={}){
 const store=options.store??intelligenceStore,saved=await store.get(record.id,run);
 if(!saved)throw Error('INTELLIGENCE_NOT_FOUND');
 const guardian=checkExactAnswer(saved.analysis,record,text,options.now);
 if(options.action!=='reject'&&guardian.status!=='approved')return {status:'blocked',guardian};
 if(!await store.review(record.id,run,admin,text,approvalFingerprint(saved.analysis,record,text),options.action??'approve'))throw Error('INTELLIGENCE_RESULT_STALE');
 return {status:options.action==='reject'?'rejected':'approved_for_review_only',guardian};
}
