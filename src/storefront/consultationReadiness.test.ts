import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { createConsultationRouter } from './consultationRouter';
import { checkConsultationReadiness } from './consultationReadiness';
import { consultationSchemaReady } from './consultationSupabase';
import { createClient } from '@supabase/supabase-js';

const healthy={enabled:()=>true,configured:()=>true,notificationReady:()=>true,storageReady:async()=>true};
test('local readiness gates do not query storage or disclose configuration details',async()=>{
  let calls=0;const storageReady=async()=>{calls++;return true;};
  for(const [gate,reason] of [['enabled','disabled'],['configured','configuration_incomplete'],['notificationReady','notification_unavailable']]) {
    assert.deepEqual(await checkConsultationReadiness({...healthy,storageReady,[gate]:()=>false}),{enabled:false,unavailableReason:reason});
  }
  assert.equal(calls,0);
  assert.deepEqual(await checkConsultationReadiness(healthy),{enabled:true,unavailableReason:null});
  assert.deepEqual(await checkConsultationReadiness({...healthy,storageReady:async()=>false}),{enabled:false,unavailableReason:'storage_unavailable'});
  assert.deepEqual(await checkConsultationReadiness({...healthy,configured:()=>{throw Error('PRIVATE_KEY');}}),{enabled:false,unavailableReason:'configuration_incomplete'});
  for(const deadline of [0,-1,3001,Infinity]) assert.equal((await checkConsultationReadiness({...healthy,storageReady},deadline)).enabled,false);
  assert.equal(calls,0);
});
test('a hung adapter is aborted and a late healthy result cannot reopen the completed probe',async()=>{
  let signal:AbortSignal;let resolve!:(v:boolean)=>void;
  const result=await checkConsultationReadiness({...healthy,storageReady:async s=>{signal=s;return new Promise<boolean>(r=>{resolve=r;});}},20);
  assert.equal(signal!.aborted,true);assert.deepEqual(result,{enabled:false,unavailableReason:'storage_timeout'});
  resolve(true);await new Promise(r=>setTimeout(r,5));assert.equal(result.enabled,false);
});
test('actual Supabase RPC builder receives cancellation; no hosted query is made',async()=>{
  let sawAbort=false;let called=0;
  const db=createClient('https://synthetic.invalid','synthetic-only',{global:{fetch:async(url,init)=>{
    called++;assert.equal(String(url),'https://synthetic.invalid/rest/v1/rpc/consultation_schema_ready');
    assert.ok(init?.signal);return new Promise<Response>((_resolve,reject)=>{
      init!.signal!.addEventListener('abort',()=>{sawAbort=true;reject(Error('PRIVATE_TRANSPORT'));},{once:true});
    });
  }}});
  const result=await checkConsultationReadiness({...healthy,storageReady:signal=>consultationSchemaReady(db,signal)},25);
  assert.equal(result.unavailableReason,'storage_timeout');assert.equal(sawAbort,true);assert.equal(called,1);
});

test('configuration reports a sanitized storage failure without admitting or sending',async()=>{
  let writes=0;
  const app=express();app.use('/inquiries',createConsultationRouter({enabled:()=>true,origin:()=> 'https://victoriosas.online',abuseKey:()=> 'synthetic-only',
    delivery:{ready:()=>true,send:async()=>{writes++;return 'not-allowed';}},
    store:{ready:async()=>{throw Error('PRIVATE_DATABASE_DETAIL');},claim:async()=>{writes++;return {state:'accepted'};},finish:async()=>false}}));
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  try {
    const response=await fetch(`http://127.0.0.1:${(server.address() as any).port}/inquiries/config`);
    const body=await response.json();assert.equal(body.enabled,false);assert.equal(body.unavailableReason,'storage_unavailable');
    assert.equal(response.headers.get('cache-control'),'no-store');assert.doesNotMatch(JSON.stringify(body),/PRIVATE_DATABASE_DETAIL/);assert.equal(writes,0);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
test('HTTP config and admission both close on storage timeout without writes or notifications', {timeout:10000},async()=>{
  let writes=0;let aborted=0;
  const app=express();app.use('/inquiries',createConsultationRouter({enabled:()=>true,origin:()=> 'https://victoriosas.online',abuseKey:()=> 'synthetic-only',
    delivery:{ready:()=>true,send:async()=>{writes++;return 'not-allowed';}},
    store:{ready:async signal=>{signal!.addEventListener('abort',()=>{aborted++;},{once:true});return new Promise(()=>{});},
      claim:async()=>{writes++;return {state:'accepted'};},finish:async()=>{writes++;return false;}}}));
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${(server.address() as any).port}/inquiries`;
  try {
    const config=await fetch(base+'/config');assert.equal((await config.json()).unavailableReason,'storage_timeout');
    const response=await fetch(base,{method:'POST',headers:{origin:'https://victoriosas.online','content-type':'application/json'},body:'{}'});
    assert.equal(response.status,503);assert.equal(aborted,2);assert.equal(writes,0);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
