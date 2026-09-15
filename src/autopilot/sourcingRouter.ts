import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { requireControlPlaneAuth,getAutopilotPrincipal } from './auth';
import { sourcingConfig, type SourcingConfig } from './sourcingEvidence';
import { runSourcing } from './sourcingOrchestrator';
import { createSourcingStore, type SourcingStore } from './sourcingStore';
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
    sourcing:{provider:'cj',configured:Boolean(process.env.CJ_API_KEY)},governance:{councilEnabled:true,autonomousPurchaseAllowed:false},
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

 const executeAuthorizedShadow=async(authorization:ShadowRunAuthorization,res:any)=>{
   const base=sourcingConfig();
   if(base.mode!=='shadow') return res.status(403).json({error:'SHADOW_MODE_REQUIRED'});
   const policyConfig=applyAuthorizedShadowPolicy(base,authorization.policy);
   const config={...policyConfig,mode:'shadow' as const,
    maxCandidates:Math.max(1,Math.min(policyConfig.maxCandidates,authorization.maxCandidates,5)),
    maxAiCalls:Math.max(1,Math.min(policyConfig.maxAiCalls,authorization.maxAiCalls,3)),
    durationMs:Math.max(5000,Math.min(authorization.durationMs,40000))};
   const result=await runner(storeFactory(),config,`production-shadow-once:${authorization.id}`);
   return res.json({...result,manual:true,cronEnabled:base.enabled,shadow:true,policyVersion:authorization.policy?.policyVersion||null});
 };

 // Explicit operator-only escape hatch for a SINGLE bounded production shadow run.
 // It does not enable the cron or accept a mode parameter. Authorization is
 // atomically consumed from Supabase before any provider call is made.
 router.post('/sourcing/production-shadow-once',async(req,res)=>{
  if(!productionShadowSafetyReady()) return res.status(403).json({error:'PRODUCTION_SHADOW_SAFETY_NOT_READY'});
  if(!process.env.CJ_API_KEY?.trim()) return res.status(503).json({error:'CJ_API_NOT_CONFIGURED'});
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
  if(!process.env.CJ_API_KEY?.trim()) return res.status(503).json({error:'CJ_API_NOT_CONFIGURED'});
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
