import { randomUUID } from 'node:crypto';
import { getCJClient } from '../services/cjDropshipping';
import { runApprovalCouncil } from './approvalCouncil';
import { buildCommercialDraft } from './draftBuilder';
import { evaluateOpportunity } from './opportunityEngine';
import { evidenceIdentity, evidenceVersion, normalizeCJ, validateEvidence, type Evidence, type SourcingConfig } from './sourcingEvidence';
import { sourcingModelBudget } from './sourcingModelBudget';
import type { SourcingStore, Run, Item } from './sourcingStore';

const terminal=new Set(['needs_evidence','evidence_rejected','pricing_rejected','council_rejected','shadow_completed','published','failed_terminal']);
export interface SourcingDependencies {
  discover:(config:SourcingConfig)=>Promise<Evidence[]>;
  council:typeof runApprovalCouncil;
  afterCheckpoint?:(stage:string)=>void; // fault-injection seam, never exposed through HTTP
}
export const liveSourcing: SourcingDependencies={
  async discover(config) {const cj=getCJClient(); if(!cj) throw new Error('CJ_NOT_CONFIGURED');
    const result=await cj.searchProducts({keyword:config.keyword,pageSize:config.maxCandidates});
    return result.products.slice(0,config.maxCandidates).map(p=>normalizeCJ(p,config));},
  council:runApprovalCouncil,
};
export function errorClass(error:unknown) {
  const e=error as {message?:string;status?:number;retryAfterMs?:number};
  const retryable=[408,429,502,503,504].includes(e.status || 0) || /timeout|fetch failed|network|database|budget/i.test(e.message || '');
  return {code:e.status ? `PROVIDER_HTTP_${e.status}` : retryable?'TRANSIENT_FAILURE':'INVALID_EVIDENCE_OR_CONFIGURATION',retryable,
    delay:Math.min(Math.max(e.retryAfterMs || 10000,1000),3600000)};
}
export async function runSourcing(store:SourcingStore, config:SourcingConfig, key:string, deps=liveSourcing) {
  const claimed=await store.command<{status:string;run:Run}>('claim',{scope:`cj:${config.destination}`,key,owner:randomUUID(),mode:config.mode,config});
  if(claimed.status!=='claimed') return {status:claimed.status,run_id:claimed.run.id,mode:claimed.run.mode};
  const run=claimed.run; config=run.config;
  const fence={run:run.id,owner:run.lease_owner,generation:run.lease_generation};
  const deadline=Date.now()+config.durationMs;
  const call=<T=any>(command:string,args:Record<string,unknown>={})=>store.command<T>(command,{...fence,...args});
  const checkpoint=async(item:Item,status:string,data:Record<string,unknown>={})=>{
    await call('checkpoint',{item:item.id,status,data});item.status=status;Object.assign(item.checkpoint,data);deps.afterCheckpoint?.(status);
  };
  try {
    if(!run.discovery_done){
      const evidence=await deps.discover(config);
      await call('discover',{items:evidence.slice(0,config.maxCandidates).map(e=>({identity:evidenceIdentity(e),version:evidenceVersion(e),payload:e}))});
      deps.afterCheckpoint?.('discovered');
    }
    const items=await call<Item[]>('items');
    for(const item of items){
      if(Date.now()>deadline-1500) break;
      if(terminal.has(item.status) || (item.next_retry_at && Date.parse(item.next_retry_at)>Date.now())) continue;
      try {
        if(item.status==='failed_retryable') item.status=item.checkpoint.resumeStage || 'normalized';
        if(item.status==='discovered') await checkpoint(item,'normalized');
        if(item.status==='normalized'){
          const reasons=validateEvidence(item.payload,config);
          if(reasons.length){await checkpoint(item,'needs_evidence',{reasons});continue;}
          if(item.payload.stock===0 || ['high','critical'].includes(item.payload.candidate?.risk || '')) {await checkpoint(item,'evidence_rejected',{reasons:['KNOWN_STOCK_OR_RISK_REJECTION']});continue;}
          await checkpoint(item,'evidence_validated');
        }
        if(item.status==='evidence_validated') {
          const candidate={...item.payload.candidate!,pricing:{...item.payload.candidate!.pricing,targetNetMarginPct:config.minMargin!}};
          const quote=evaluateOpportunity(candidate);
          await checkpoint(item,'opportunity_scored',{quote,candidate,pricingVersion:'existing-v4',calculatedAt:new Date().toISOString()});
        }
        if(item.status==='opportunity_scored') await checkpoint(item,'pricing_completed');
        if(item.status==='pricing_completed'){
          const {quote,candidate}=item.checkpoint;
          if(quote.pricing.estimatedNetMarginPct<config.minMargin! || quote.status!=='draft_ready'){
            await checkpoint(item,quote.status==='review'?'needs_evidence':'pricing_rejected',{reasons:quote.warnings});continue;}
          const draft=await buildCommercialDraft(candidate,item.payload.facts,false,quote);
          await call('draft',{item:item.id,draft});item.status='draft_created';deps.afterCheckpoint?.('draft_created');
          await checkpoint(item,'council_pending',{draft});
        }
        if(item.status==='draft_created') {
          // Draft RPC committed atomically; its deterministic content can be reconstructed.
          const draft=await buildCommercialDraft(item.checkpoint.candidate,item.payload.facts,false,item.checkpoint.quote);
          await checkpoint(item,'council_pending',{draft});
        }
        if(item.status==='council_pending'){
          const result=await sourcingModelBudget.run({deadline,beforeCall:async()=>{if(Date.now()>deadline-1500)throw new Error('AI_BUDGET_TIMEOUT');await call('reserve_ai',{calls:1});}},()=>deps.council(item.checkpoint.draft));
          await call('council',{item:item.id,council:result});
          item.status=result.decision==='approve'&&!result.ownerEscalationRequired?'council_approved':'council_rejected';
          deps.afterCheckpoint?.(item.status);
        }
        if(item.status==='council_approved'){
          // Revalidate evidence at the final side-effect boundary after any pause.
          const reasons=validateEvidence(item.payload,config);
          if(reasons.length){await checkpoint(item,'needs_evidence',{reasons});continue;}
          await call('publish',{item:item.id});deps.afterCheckpoint?.(config.mode==='shadow'?'shadow_completed':'published');
        }
      } catch(error){
        if((error as Error).message==='SIMULATED_CRASH' || (error as Error).message==='FENCE_REJECTED') throw error;
        const classified=errorClass(error);
        await call('checkpoint',{item:item.id,status:classified.retryable&&item.attempt<config.retries?'failed_retryable':'failed_terminal',
          data:{resumeStage:item.status},error:classified.code,retryAt:new Date(Date.now()+classified.delay*2**item.attempt).toISOString()});
      }
    }
    const result=await call<Run>('release');
    return {run_id:run.id,status:result.status,mode:run.mode};
  }catch(error){
    if(['SIMULATED_CRASH','FENCE_REJECTED'].includes((error as Error).message)) throw error;
    const classified=errorClass(error);
    await call('release',{error:classified.code,terminal:!classified.retryable || run.attempt>config.retries,retryAt:new Date(Date.now()+classified.delay).toISOString()});
    throw new Error(classified.code);
  }
}
