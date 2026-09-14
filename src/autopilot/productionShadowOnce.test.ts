import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { createSourcingRouter } from './sourcingRouter';
import type { SourcingStore } from './sourcingStore';

const keys = [
  'VERCEL_ENV','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','CJ_API_KEY','AUTOPILOT_SHADOW_MODE',
  'CHECKOUT_ENABLED','AUTOPILOT_PURCHASE_LIMIT_USD','AUTOPILOT_LEGACY_SOURCING_ENABLED',
  'AUTOPILOT_V4_SOURCING_ENABLED','MAX_CANDIDATES_PER_RUN','MAX_AI_CALLS_PER_RUN','MAX_RUN_DURATION_MS',
] as const;
function snapshotEnv(){return Object.fromEntries(keys.map(key=>[key,process.env[key]]));}
function restoreEnv(before:Record<string,string|undefined>){for(const key of keys){const value=before[key];if(value===undefined)delete process.env[key];else process.env[key]=value;}}
async function withServer(router:ReturnType<typeof createSourcingRouter>,fn:(base:string)=>Promise<void>){
 const app=express();app.use(express.json());app.use('/api/autopilot/v4',router);
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${(server.address() as any).port}/api/autopilot/v4`;
 try{await fn(base);}finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
}
function safeProductionEnv(){
 process.env.VERCEL_ENV='production';
 process.env.SUPABASE_URL='https://jfjzpwlrhzqbcrvqxhzf.supabase.co';
 process.env.SUPABASE_SERVICE_ROLE_KEY='fixture-service-role';
 process.env.CJ_API_KEY='fixture-cj';
 process.env.AUTOPILOT_SHADOW_MODE='true';
 process.env.CHECKOUT_ENABLED='false';
 process.env.AUTOPILOT_PURCHASE_LIMIT_USD='0';
 process.env.AUTOPILOT_LEGACY_SOURCING_ENABLED='false';
 process.env.AUTOPILOT_V4_SOURCING_ENABLED='false';
 process.env.MAX_CANDIDATES_PER_RUN='30';
 process.env.MAX_AI_CALLS_PER_RUN='12';
 process.env.MAX_RUN_DURATION_MS='40000';
}

test('one-time production shadow POST is bounded, shadow-only and does not enable cron',async()=>{
 const before=snapshotEnv();safeProductionEnv();let consumed=0,ran=0;const store={} as SourcingStore;
 try{
  const router=createSourcingRouter(()=>store,async token=>{consumed++;return token==='valid-shadow-token-abcdefghijklmnopqrstuvwxyz'?{id:'auth-1',maxCandidates:3,maxAiCalls:2,durationMs:15000}:null;},
   (async(_store,config,key)=>{ran++;assert.equal(config.mode,'shadow');assert.equal(config.enabled,false);assert.equal(config.maxCandidates,3);assert.equal(config.maxAiCalls,2);assert.equal(config.durationMs,15000);assert.equal(key,'production-shadow-once:auth-1');return {status:'completed_no_candidates',run_id:'run-1',mode:'shadow'};}) as any);
  await withServer(router,async base=>{
   assert.equal((await fetch(`${base}/sourcing/production-shadow-once`,{method:'POST'})).status,401);
   const ok=await fetch(`${base}/sourcing/production-shadow-once`,{method:'POST',headers:{'x-autopilot-shadow-token':'valid-shadow-token-abcdefghijklmnopqrstuvwxyz'}});
   assert.equal(ok.status,200);const body=await ok.json() as any;assert.equal(body.shadow,true);assert.equal(body.cronEnabled,false);assert.equal(body.status,'completed_no_candidates');
  });
  assert.equal(consumed,1);assert.equal(ran,1);
 }finally{restoreEnv(before);}
});

test('one-time production shadow GET consumes UUID capability and remains bounded',async()=>{
 const before=snapshotEnv();safeProductionEnv();let consumedById=0,ran=0;const store={} as SourcingStore;
 const capability='123e4567-e89b-42d3-a456-426614174000';
 try{
  const router=createSourcingRouter(()=>store,async()=>null,
   (async(_store,config,key)=>{ran++;assert.equal(config.mode,'shadow');assert.equal(config.maxCandidates,2);assert.equal(config.maxAiCalls,1);assert.equal(config.durationMs,10000);assert.equal(key,'production-shadow-once:auth-get');return {status:'completed_no_candidates',run_id:'run-get',mode:'shadow'};}) as any,
   async id=>{consumedById++;return id===capability?{id:'auth-get',maxCandidates:2,maxAiCalls:1,durationMs:10000}:null;});
  await withServer(router,async base=>{
   assert.equal((await fetch(`${base}/sourcing/production-shadow-once`)).status,401);
   const ok=await fetch(`${base}/sourcing/production-shadow-once?authorization=${capability}`);
   assert.equal(ok.status,200);const body=await ok.json() as any;assert.equal(body.shadow,true);assert.equal(body.cronEnabled,false);assert.equal(body.status,'completed_no_candidates');
  });
  assert.equal(consumedById,1);assert.equal(ran,1);
 }finally{restoreEnv(before);}
});

test('one-time production shadow route fails closed when production safety flags are not safe',async()=>{
 const before=snapshotEnv();safeProductionEnv();process.env.AUTOPILOT_SHADOW_MODE='false';let consumed=0;
 try{
  const router=createSourcingRouter(()=>({} as SourcingStore),async()=>{consumed++;return {id:'auth-2',maxCandidates:1,maxAiCalls:1,durationMs:5000};},async()=>({} as any));
  await withServer(router,async base=>{const response=await fetch(`${base}/sourcing/production-shadow-once`,{method:'POST',headers:{'x-autopilot-shadow-token':'valid-shadow-token-abcdefghijklmnopqrstuvwxyz'}});assert.equal(response.status,403);});
  assert.equal(consumed,0);
 }finally{restoreEnv(before);}
});
