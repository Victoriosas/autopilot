import { beautyServerDatabase } from './beautyDatabase';
import { approveAndSendConsultationReply,type ReplyOutcome } from './consultationReplyDelivery';
import { checkExactAnswer,approvalFingerprint,type IntelligenceAnalysis } from './consultationIntelligence';
import type { ConsultationRecord } from './consultationSupabase';

export function decideIntelligenceAutonomy(policy:{level:0|1|2;shadow:boolean;approved:boolean;safe:boolean;evaluated:boolean;categoryEnabled:boolean}){
 if(policy.shadow||policy.level===0)return 'no_send';
 if(!policy.safe)return 'human_review';
 if(policy.level===1)return policy.approved?'approved_send':'human_review';
 return policy.evaluated&&policy.categoryEnabled?'limited_send':'human_review';
}
type SavedApproval={analysis:IntelligenceAnalysis;approvedText:string;approvalHash:string;approvedBy:string};
export async function dispatchIntelligenceReply(record:ConsultationRecord,run:string,admin:string,expectedHash:string,deps:{
 env?:NodeJS.ProcessEnv;now?:Date;load?:()=>Promise<SavedApproval|null>;claim?:()=>Promise<boolean>;
 send?:(record:ConsultationRecord,admin:string,text:string,claim:()=>Promise<boolean>)=>Promise<ReplyOutcome>;
}={}):Promise<ReplyOutcome|'shadow'|'blocked'>{
 const env=deps.env??process.env;
 if(env.CONSULTATION_INTELLIGENCE_LIVE_REVIEW_ENABLED!=='true'||env.CONSULTATION_INTELLIGENCE_MODE!=='review'||env.CONSULTATION_INTELLIGENCE_ACTIVATION_APPROVED!=='true')return 'shadow';
 const load=deps.load??(async()=>{
  const r=await beautyServerDatabase().from('consultation_intelligence_runs').select('analysis,exact_text,approval_hash,approved_by').eq('id',run).eq('request_id',record.id).eq('state','approved').maybeSingle();
  if(r.error)throw Error('INTELLIGENCE_UNAVAILABLE');return r.data?{analysis:r.data.analysis,approvedText:r.data.exact_text,approvalHash:r.data.approval_hash,approvedBy:r.data.approved_by}:null;
 });
 const saved=await load();
 if(!saved||saved.approvedBy!==admin||saved.approvalHash!==expectedHash||approvalFingerprint(saved.analysis,record,saved.approvedText)!==expectedHash||checkExactAnswer(saved.analysis,record,saved.approvedText,deps.now).status!=='approved')return 'blocked';
 if(record.input.responseChannel!=='email'||!record.input.email)return 'invalid_channel';
 const claim=deps.claim??(async()=>{
  const r=await beautyServerDatabase().rpc('consultation_ai_begin_dispatch',{p_request:record.id,p_run:run,p_admin:admin,p_hash:expectedHash,p_input:record.input,p_knowledge:saved.analysis.knowledgeVersion});
  if(r.error)throw Error('INTELLIGENCE_UNAVAILABLE');return r.data===true;
 });
 // The existing sender owns the single reply outbox and conservative unknown-outcome handling.
 if(deps.send){if(!await claim())return 'already_processing';return deps.send(record,admin,saved.approvedText,async()=>true);}
 return approveAndSendConsultationReply(record,admin,{env,approvedText:saved.approvedText,claim});
}
