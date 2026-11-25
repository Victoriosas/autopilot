import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { createSixAgentStatusRouter } from './sixAgentStatusRouter';

test('admin agent status never falls back to primary task rows while synthetic reader is unconfigured',async t=>{
  const names=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_ANON_KEY','VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY'] as const;
  const previous=names.map(name=>process.env[name]);
  t.after(()=>names.forEach((name,index)=>previous[index]===undefined?delete process.env[name]:process.env[name]=previous[index]!));
  process.env.SUPABASE_URL='https://primary.supabase.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY='fixture-key';
  process.env.SUPABASE_ANON_KEY='synthetic-public-key';
  const nativeFetch=globalThis.fetch.bind(globalThis);
  let role='admin',ledgerReads=0;
  t.mock.method(globalThis,'fetch',async(input:Parameters<typeof fetch>[0],options?:RequestInit)=>{
    const url=new URL(input instanceof Request?input.url:String(input));
    if(url.hostname==='127.0.0.1')return nativeFetch(input,options);
    assert.equal(url.origin,'https://primary.supabase.invalid');
    const headers=new Headers(options?.headers);
    if(url.pathname==='/auth/v1/user'){
      assert.equal(headers.get('authorization'),'Bearer synthetic-admin');
      return Response.json({id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',app_metadata:{},user_metadata:{}});
    }
    if(url.pathname==='/rest/v1/profiles')return Response.json({role});
    ledgerReads++;
    return Response.json({unexpected_ledger_read:true},{status:500});
  });
  const app=express();app.use('/api/autopilot/v4/agents-status',createSixAgentStatusRouter());
  app.use('/configured',createSixAgentStatusRouter(async()=>({source:'supabase',scope:'cloud_v3_read_only',environment:'isolated',generatedAt:new Date().toISOString(),partial:false,
    agents:['director','software','infrastructure','consultations','followup','reports'].map(id=>({id,pending:0,running:0,blocked:1,completed:1,lastHeartbeat:null,results:1,lastResult:null}))})));
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));});
  const {port}=server.address() as {port:number};
  const request=(auth=true)=>fetch(`http://127.0.0.1:${port}/api/autopilot/v4/agents-status`,{
    headers:auth?{authorization:'Bearer synthetic-admin'}:{},signal:AbortSignal.timeout(5000)});
  assert.equal((await request(false)).status,401);
  role='member';assert.equal((await request()).status,403);
  role='admin';const response=await request();
  assert.equal(response.status,503);
  assert.deepEqual(await response.json(),{error:'DIRECTOR_SYNTHETIC_READER_NOT_CONFIGURED'});
  assert.equal(ledgerReads,0,'unconfigured panel must not read production customer or task rows');
  const configured=await fetch(`http://127.0.0.1:${port}/configured`,{headers:{authorization:'Bearer synthetic-admin'}});
  assert.equal(configured.status,200);assert.equal((await configured.json()).agents.length,6);
  assert.equal(configured.headers.get('cache-control'),'no-store');
});
