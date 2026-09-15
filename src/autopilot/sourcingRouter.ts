import { randomUUID, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { requireSupabaseAdminAuth } from '../security/adminAuth';
import { cjSourcingReadConfigured } from '../services/cjSourcingProvider';
import { requireControlPlaneAuth,getAutopilotPrincipal } from './auth';
import { marketProviderStatus } from './marketEvidence';
import { sourcingConfig, type SourcingConfig } from './sourcingEvidence';
import { runSourcing } from './sourcingOrchestrator';
import { createSourcingStore, type SourcingStore } from './sourcingStore';
import { inspectShadowRun } from './shadowInspector';
import { optimizeCJSearchKeyword } from './searchKeywordOptimizer';
import { consumeShadowRunAuthorization,consumeShadowRunAuthorizationById,type ShadowRunAuthorization,type ShadowEconomicPolicy } from './shadowRunAuthorization';

export function validCronToken(header:string|undefined,secret=process.env.CRON_SECRET) {
  if(!secret || !secret.trim() || !header) return false;
  const expected=Buffer.from(`Bearer ${secret}`),actual=Buffer.from(header);
  return expected.length===actual.length && timingSafeEqual(expected,actual);
}

type ShadowAuthorizationConsumer=(token:string)=>Promise<ShadowRunAuthorization|null>;
type ShadowAuthorizationIdConsumer=(id:string)=>Promise<ShadowRunAuthorization|null>;
type SourcingRunner=typeof runSourcing;

function productionShadowSafetyReady() {
  const purchaseLimit=Number(process.env.AUTOPILOT_PURCHASE_LIMIT_USD || '0');
  return process.env.VERCEL_ENV==='production'
    && (process.env.SUPABASE_URL || '').includes('jfjzpwlrhzqbcrvqxhzf')
    && process.env.AUTOPILOT_SHADOW_MODE!=='false'
    && process.env.CHECKOUT_ENABLED!=='true'
    && Number.isFinite(purchaseLimit)
    && purchaseLimit===0
    && process.env.AUTOPILOT_LEGACY_SOURCING_ENABLED!=='true';
}

function applyAuthorizedShadowPolicy(base:SourcingConfig,policy?:ShadowEconomicPolicy):SourcingConfig {
  if(!policy) return base;
  if(base.destination!=='UY' || base.currency!=='UYU' || base.providerCurrency!=='USD') {
    throw new Error('URUGUAY_SHADOW_POLICY_CONTEXT_MISMATCH');
  }
  return {
    ...base,
    providerToStoreRate:policy.providerToStoreRate ?? base.providerToStoreRate,
    minMargin:policy.minMargin ?? base.minMargin,
    customsRatePct:policy.customsRatePct ?? base.customsRatePct,
    paymentFeePct:policy.paymentFeePct ?? base.paymentFeePct,
    paymentFeeFixed:policy.paymentFeeFixed ?? base.paymentFeeFixed,
    returnReservePct:policy.returnReservePct ?? base.returnReservePct,
    acquisitionCost:policy.acquisitionCost ?? base.acquisitionCost,
    taxRatePct:policy.taxRatePct ?? base.taxRatePct,
    imageSaleUseAllowed:policy.imageSaleUseAllowed ?? base.imageSaleUseAllowed,
    commercialProxiesAllowed:policy.commercialProxiesAllowed ?? base.commercialProxiesAllowed,
    version:policy.policyVersion ? `${base.version}:${policy.policyVersion}` : base.version,
  };
}

const UI_SHADOW_POLICY: ShadowEconomicPolicy = {
  providerToStoreRate:41.02,
  minMargin:30,
  customsRatePct:60,
  paymentFeePct:7.31,
  paymentFeeFixed:0,
  returnReservePct:5,
  acquisitionCost:150,
  taxRatePct:18.03,
  imageSaleUseAllowed:true,
  commercialProxiesAllowed:true,
  policyVersion:'uy-shadow-ui-v1-2026-09-14',
};

function uiShadowConfig(body:any,keywordOverride?:string):SourcingConfig {
  const base=sourcingConfig();
  const policyConfig=applyAuthorizedShadowPolicy(base,UI_SHADOW_POLICY);
  const rawKeyword=typeof keywordOverride==='string'?keywordOverride:(typeof body?.keyword==='string'?body.keyword.trim():'');
  const keyword=(rawKeyword || 'facial headband').replace(/[\r\n\t]/g,' ').replace(/\s+/g,' ').slice(0,80);
  const requested=Number(body?.maxCandidates || 3);
  const maxCandidates=Number.isFinite(requested)?Math.max(1,Math.min(Math.floor(requested),3)):3;
  return {
    ...policyConfig,
    enabled:false,
    mode:'shadow',
    keyword,
    maxCandidates,
    maxAiCalls:3,
    durationMs:40000,
    retries:Math.min(policyConfig.retries,2),
  };
}

export function createSourcingRouter(
  storeFactory:()=>SourcingStore=createSourcingStore,
  consumeAuthorization:ShadowAuthorizationConsumer=consumeShadowRunAuthorization,
  runner:SourcingRunner=runSourcing,
  consumeAuthorizationById:ShadowAuthorizationIdConsumer=consumeShadowRunAuthorizationById,
): Router {
 const router=Router();
 router.get('/cron/sourcing',async(req,res)=>{
  if(!validCronToken(req.header('authorization'))) return res.status(401).json({error:'CRON_AUTH_REQUIRED'});
  const config=sourcingConfig();
  if(!config.enabled) return res.json({status:'skipped_disabled',run_id:null,mode:config.mode});
  try {return res.json(await runner(storeFactory(),config,`cron:${Math.floor(Date.now()/21600000)}`));}
  catch {return res.status(503).json({error:'SOURCING_RUN_INCOMPLETE'});}
 });
 router.get('/sourcing/status',requireControlPlaneAuth,async(_req,res)=>{
  try {const config=sourcingConfig(); const state=await storeFactory().command('status',{});
   const runs=state.runs as any[];
   return res.json({orchestrator:{enabled:config.enabled,shadowMode:config.mode==='shadow',lastRun:runs[0]||null,
    lastSuccessfulRun:runs.find(r=>['completed','completed_no_candidates'].includes(r.status))||null,
    lastCompletedNoCandidates:runs.find(r=>r.status==='completed_no_candidates')||null,
    currentlyRunning:runs.some(r=>Date.parse(r.lease_expires_at)>Date.now()),
    resumableRuns:runs.filter(r=>['queued','running','resuming','failed_retryable'].includes(r.status)).length},
    sourcing:{provider:'cj',configured:cjSourcingReadConfigured(config),transportPolicy:config.mode==='shadow'?'mcp_first_rest_fallback':'rest'},
    marketEvidence:{priority:['mercadolibre_uy','gemini_google_search','openrouter_web_search'],...marketProviderStatus()},
    governance:{councilEnabled:true,autonomousPurchaseAllowed:false},
    commerce:{checkoutEnabled:process.env.CHECKOUT_ENABLED==='true'}});
  }catch{return res.status(503).json({error:'SOURCING_STATUS_UNAVAILABLE'});}
 });
 router.post('/sourcing/shadow-run',requireControlPlaneAuth,async(req,res)=>{
  if(getAutopilotPrincipal(res).role!=='admin') return res.status(403).json({error:'ADMIN_REQUIRED'});
  if(process.env.AUTOPILOT_ISOLATED_TEST_ENV!=='true' || process.env.VERCEL_ENV==='production' ||
   (process.env.SUPABASE_URL||'').includes('jfjzpwlrhzqbcrvqxhzf')) return res.status(403).json({error:'ISOLATED_ENV_REQUIRED'});
  const key=req.header('idempotency-key');
  if(!key || !/^[a-zA-Z0-9_-]{8,100}$/.test(key)) return res.status(400).json({error:'IDEMPOTENCY_KEY_REQUIRED'});
  try{return res.json(await runner(storeFactory(),{...sourcingConfig(),mode:'shadow'},`manual:${key}`));}
  catch{return res.status(503).json({error:'SOURCING_RUN_INCOMPLETE'});}
 });

 // Browser-facing V4 console. It accepts only a verified Supabase admin session,
 // hard-forces shadow mode and uses the reviewed Uruguay shadow policy. No
 // purchase/publication flag can be supplied by the client.
 router.post('/sourcing/admin-shadow-run',requireSupabaseAdminAuth,async(req,res)=>{
  if(!productionShadowSafetyReady()) return res.status(403).json({error:'PRODUCTION_SHADOW_SAFETY_NOT_READY'});
  if(!cjSourcingReadConfigured({mode:'shadow'})) return res.status(503).json({error:'CJ_READ_PROVIDER_NOT_CONFIGURED'});
  try {
   const rawKeyword=typeof req.body?.keyword==='string'?req.body.keyword:'facial headband';
   const searchQuery=await optimizeCJSearchKeyword(rawKeyword);
   const config=uiShadowConfig(req.body,searchQuery.keyword);
   const result=await runner(storeFactory(),config,`admin-ui-shadow:${randomUUID()}`);
   const inspection=await inspectShadowRun(result.run_id);
   return res.json({
    ...result,
    manual:true,
    shadow:true,
    cronEnabled:false,
    policyVersion:UI_SHADOW_POLICY.policyVersion,
    transportPolicy:'mcp_first_rest_fallback',
    marketEvidence:{priority:['mercadolibre_uy','gemini_google_search','openrouter_web_search'],...marketProviderStatus()},
    searchQuery,
    safety:{checkout:false,purchases:false,autoPublish:false,maxCandidates:config.maxCandidates,maxAiCalls:config.maxAiCalls},
    inspection,
   });
  } catch(error:any) {
   console.error('Admin shadow run failed:',error?.message || error);
   return res.status(503).json({error:'ADMIN_SHADOW_RUN_INCOMPLETE'});
  }
 });

 router.get('/sourcing/admin-shadow-status',requireSupabaseAdminAuth,async(req,res)=>{
  try {
   const runId=typeof req.query.runId==='string' && /^[0-9a-f-]{36}$/i.test(req.query.runId)?req.query.runId:undefined;
   const inspection=await inspectShadowRun(runId);
   return res.json({
    shadow:true,
    cronEnabled:sourcingConfig().enabled,
    transportPolicy:'mcp_first_rest_fallback',
    marketEvidence:{priority:['mercadolibre_uy','gemini_google_search','openrouter_web_search'],...marketProviderStatus()},
    safety:{checkout:process.env.CHECKOUT_ENABLED==='true',purchaseLimitUsd:Number(process.env.AUTOPILOT_PURCHASE_LIMIT_USD || '0'),autoPublish:false},
    ...inspection,
   });
  } catch(error:any) {
   console.error('Admin shadow status failed:',error?.message || error);
   return res.status(503).json({error:'ADMIN_SHADOW_STATUS_UNAVAILABLE'});
  }
 });

 const executeAuthorizedShadow=async(authorization:ShadowRunAuthorization,res:any)=>{
   const base=sourcingConfig();
   if(base.mode!=='shadow') return res.status(403).json({error:'SHADOW_MODE_REQUIRED'});
   const policyConfig=applyAuthorizedShadowPolicy(base,authorization.policy);
   const config={...policyConfig,mode:'shadow' as const,
    maxCandidates:Math.max(1,Math.min(policyConfig.maxCandidates,authorization.maxCandidates,5)),
    maxAiCalls:Math.max(1,Math.min(policyConfig.maxAiCalls,authorization.maxAiCalls,3)),
    durationMs:Math.max(5000,Math.min(authorization.durationMs,40000))};
   const result=await runner(storeFactory(),config,`production-shadow-once:${authorization.id}`);
   return res.json({...result,manual:true,cronEnabled:base.enabled,shadow:true,transportPolicy:'mcp_first_rest_fallback',policyVersion:authorization.policy?.policyVersion||null});
 };

 // Explicit operator-only escape hatch for a SINGLE bounded production shadow run.
 // It does not enable the cron or accept a mode parameter. Authorization is
 // atomically consumed from Supabase before any provider call is made.
 router.post('/sourcing/production-shadow-once',async(req,res)=>{
  if(!productionShadowSafetyReady()) return res.status(403).json({error:'PRODUCTION_SHADOW_SAFETY_NOT_READY'});
  if(!cjSourcingReadConfigured({mode:'shadow'})) return res.status(503).json({error:'CJ_READ_PROVIDER_NOT_CONFIGURED'});
  const token=req.header('x-autopilot-shadow-token')?.trim();
  if(!token || token.length<32 || token.length>256) return res.status(401).json({error:'SHADOW_AUTH_REQUIRED'});
  try {
   const authorization=await consumeAuthorization(token);
   if(!authorization) return res.status(401).json({error:'SHADOW_AUTH_INVALID_OR_CONSUMED'});
   return await executeAuthorizedShadow(authorization,res);
  } catch {return res.status(503).json({error:'PRODUCTION_SHADOW_RUN_INCOMPLETE'});}
 });

 // GET is intentionally capability-based so operator tooling that cannot send a
 // POST/header can execute one authorized shadow cycle. The UUID is random,
 // expires, is consumed atomically, and cannot be replayed.
 router.get('/sourcing/production-shadow-once',async(req,res)=>{
  if(!productionShadowSafetyReady()) return res.status(403).json({error:'PRODUCTION_SHADOW_SAFETY_NOT_READY'});
  if(!cjSourcingReadConfigured({mode:'shadow'})) return res.status(503).json({error:'CJ_READ_PROVIDER_NOT_CONFIGURED'});
  const authorizationId=typeof req.query.authorization==='string'?req.query.authorization:'';
  if(!authorizationId) return res.status(401).json({error:'SHADOW_AUTH_REQUIRED'});
  try {
   const authorization=await consumeAuthorizationById(authorizationId);
   if(!authorization) return res.status(401).json({error:'SHADOW_AUTH_INVALID_OR_CONSUMED'});
   return await executeAuthorizedShadow(authorization,res);
  } catch {return res.status(503).json({error:'PRODUCTION_SHADOW_RUN_INCOMPLETE'});}
 });
 return router;
}
