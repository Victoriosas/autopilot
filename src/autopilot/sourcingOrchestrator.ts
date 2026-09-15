import { randomUUID } from 'node:crypto';
import { getCJClient } from '../services/cjDropshipping';
import { runApprovalCouncil } from './approvalCouncil';
import { buildCommercialDraft } from './draftBuilder';
import { evaluateOpportunity, type OpportunityCandidate } from './opportunityEngine';
import { applyMarketEvidence, findGroundedMarketEvidence, type MarketEvidence } from './marketEvidence';
import {
  buildCJLiveEvidence,
  evidenceIdentity,
  evidenceVersion,
  normalizeCJ,
  selectCJVariant,
  validateEvidence,
  type Evidence,
  type SourcingConfig,
} from './sourcingEvidence';
import { sourcingModelBudget } from './sourcingModelBudget';
import { assessVictoriosaFit } from './victoriosaProductFilter';
import type { SourcingStore, Run, Item } from './sourcingStore';

const terminal=new Set(['needs_evidence','evidence_rejected','pricing_rejected','council_rejected','shadow_completed','published','failed_terminal']);
export interface SourcingDependencies {
  discover:(config:SourcingConfig)=>Promise<Evidence[]>;
  marketEvidence?:(candidate:any)=>Promise<MarketEvidence>;
  council:typeof runApprovalCouncil;
  afterCheckpoint?:(stage:string)=>void;
}

export const liveSourcing: SourcingDependencies={
  async discover(config) {
    const cj=getCJClient();
    if(!cj) throw new Error('CJ_NOT_CONFIGURED');
    const enrichmentLimit=Math.max(1,Math.min(config.maxCandidates,config.durationMs>=30000?6:4));
    const result=await cj.searchProducts({keyword:config.keyword,pageSize:enrichmentLimit});
    const evidence:Evidence[]=[];
    for(const product of result.products.slice(0,enrichmentLimit)) {
      const searchObservation=normalizeCJ(product,config);
      try {
        const variants=await cj.getVariants(product.pid);
        const selected=selectCJVariant(variants);
        if(!selected) { evidence.push(searchObservation); continue; }
        const stock=await cj.getVariantStock(selected.vid);
        const freight=await cj.calculateShipping({variantId:selected.vid,countryCode:config.destination,quantity:1});
        evidence.push(buildCJLiveEvidence({product,variants,stock,freight,config,imageSaleUseAllowed:config.imageSaleUseAllowed}));
      } catch {
        evidence.push({...searchObservation,evidenceNotes:[...(searchObservation.evidenceNotes||[]),'CJ_ENRICHMENT_FAILED']});
      }
    }
    return evidence;
  },
  marketEvidence:findGroundedMarketEvidence,
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
  const reserveModelCall=async()=>{if(Date.now()>deadline-1500)throw new Error('AI_BUDGET_TIMEOUT');await call('reserve_ai',{calls:1});};
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
          const fit=assessVictoriosaFit(item.payload.candidate!,item.payload.facts);
          if(fit.decision==='reject') {await checkpoint(item,'evidence_rejected',{reasons:fit.reasons,victoriosaFit:fit});continue;}
          if(item.payload.stock===0 || ['high','critical'].includes(item.payload.candidate?.risk || '')) {await checkpoint(item,'evidence_rejected',{reasons:['KNOWN_STOCK_OR_RISK_REJECTION'],victoriosaFit:fit});continue;}
          await checkpoint(item,'evidence_validated',{victoriosaFit:fit});
        }
        if(item.status==='evidence_validated') {
          const fit=item.checkpoint.victoriosaFit || assessVictoriosaFit(item.payload.candidate!,item.payload.facts);
          let candidate:OpportunityCandidate={...item.payload.candidate!,risk:fit.risk,pricing:{...item.payload.candidate!.pricing,targetNetMarginPct:config.minMargin!}};
          let market:MarketEvidence|undefined;
          if(config.mode==='shadow' && deps.marketEvidence){
            await reserveModelCall();
            market=await deps.marketEvidence(candidate);
            if(market.status!=='ok'){
              const marketReason=market.status==='not_configured'?'MARKET_SEARCH_NOT_CONFIGURED':market.status==='provider_error'?'MARKET_SEARCH_PROVIDER_ERROR':'MARKET_EVIDENCE_INSUFFICIENT';
              await checkpoint(item,'needs_evidence',{reasons:[marketReason],marketEvidence:market,victoriosaFit:fit});continue;
            }
            candidate=applyMarketEvidence(candidate,market);
          }
          const quote=evaluateOpportunity(candidate);
          await checkpoint(item,'opportunity_scored',{quote,candidate,marketEvidence:market||null,victoriosaFit:fit,pricingVersion:market?'existing-v4+grounded-market-v1':'existing-v4',calculatedAt:new Date().toISOString()});
        }
        if(item.status==='opportunity_scored') await checkpoint(item,'pricing_completed');
        if(item.status==='pricing_completed'){
          const {quote,candidate,victoriosaFit}=item.checkpoint;
          if(victoriosaFit?.regulatoryReviewRequired){await checkpoint(item,'needs_evidence',{reasons:victoriosaFit.reasons});continue;}
          if(quote.pricing.estimatedNetMarginPct<config.minMargin! || quote.status!=='draft_ready'){
            await checkpoint(item,quote.status==='review'?'needs_evidence':'pricing_rejected',{reasons:quote.warnings});continue;
          }
          const draft=await buildCommercialDraft(candidate,item.payload.facts,false,quote);
          await call('draft',{item:item.id,draft});item.status='draft_created';deps.afterCheckpoint?.('draft_created');
          await checkpoint(item,'council_pending',{draft});
        }
        if(item.status==='draft_created') {
          const draft=await buildCommercialDraft(item.checkpoint.candidate,item.payload.facts,false,item.checkpoint.quote);
          await checkpoint(item,'council_pending',{draft});
        }
        if(item.status==='council_pending'){
          const result=await sourcingModelBudget.run({deadline,beforeCall:reserveModelCall},()=>deps.council(item.checkpoint.draft));
          await call('council',{item:item.id,council:result});
          item.status=result.decision==='approve'&&!result.ownerEscalationRequired?'council_approved':'council_rejected';
          deps.afterCheckpoint?.(item.status);
        }
        if(item.status==='council_approved'){
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
