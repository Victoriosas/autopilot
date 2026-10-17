import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { createBeautyRouter } from '../src/storefront/beautyRouter';

assert.equal(process.env.BEAUTY_SYNTHETIC_SUPABASE,'true','Disposable opt-in required');
assert.ok(process.env.SUPABASE_LOCAL_STATUS_FILE);
const config=JSON.parse(readFileSync(process.env.SUPABASE_LOCAL_STATUS_FILE,'utf8'));
const url=new URL(config.API_URL);
assert.equal(url.protocol,'http:');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'54321');
const publicKey=config.ANON_KEY||config.PUBLISHABLE_KEY,serviceKey=config.SERVICE_ROLE_KEY||config.SECRET_KEY;
assert.ok(publicKey&&serviceKey);
const client=(key:string)=>createClient(url.origin,key,{auth:{persistSession:false,autoRefreshToken:false}});
const service=client(serviceKey),customer=client(publicKey),admin=client(publicKey),anon=client(publicKey);
test('Beauty real disposable Supabase Auth + HTTP + PostgREST + RLS', {timeout:90000},async t=>{
 const users:string[]=[];
 const old=Object.fromEntries(['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_ANON_KEY','BEAUTY_REQUESTS_ENABLED'].map(key=>[key,process.env[key]]));
 Object.assign(process.env,{SUPABASE_URL:url.origin,SUPABASE_SERVICE_ROLE_KEY:serviceKey,SUPABASE_ANON_KEY:publicKey,BEAUTY_REQUESTS_ENABLED:'true'});
 let adminToken='',customerToken='';
 const app=express();app.use(express.json());app.use('/api/beauty',createBeautyRouter());
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${(server.address() as any).port}/api/beauty`;
 const input={id:randomUUID(),firstName:'Synthetic',lastName:'Client',contact:'fixture@example.test',zone:'Carrasco',service:'facial',availability:'Monday',source:'web',consent:true,consentVersion:'beauty-v1'};
 const post=(body=input)=>fetch(base+'/requests',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 try{
  await t.test('actual Auth login and server-controlled admin profile',async()=>{
   for(const [actor,role] of [[customer,'customer'],[admin,'admin']] as const){
    const email='beauty-'+randomUUID()+'@example.test',password='Fixture-'+randomUUID()+'-9a!';
    const created=await service.auth.admin.createUser({email,password,email_confirm:true});assert.equal(created.error,null);users.push(created.data.user!.id);
    const profile=await service.from('profiles').upsert({id:created.data.user!.id,role});assert.equal(profile.error,null,profile.error?.message);
    const login=await actor.auth.signInWithPassword({email,password});assert.equal(login.error,null);if(role==='admin')adminToken=login.data.session!.access_token;else customerToken=login.data.session!.access_token;
   }
  });
  await t.test('POST persists through actual PostgREST, replay safe',async()=>{
   const r=await post();assert.equal(r.status,202,await r.clone().text());const receipt=await r.json();assert.equal(receipt.id,input.id);assert(!decodeURIComponent(receipt.whatsappUrl).includes(input.contact));
   assert.equal((await post()).status,202);
   assert.equal((await post({...input,zone:'Solymar'})).status,409);
   const row=await service.from('beauty_requests').select('id,status').eq('id',input.id);assert.equal(row.error,null);assert.equal(row.data!.length,1);assert.equal(row.data![0].status,'pending');
  });
  await t.test('anonymous and customer denied, including direct table and escalation',async()=>{
   assert.equal((await fetch(base+'/admin/requests')).status,401);
   assert.equal((await fetch(base+'/admin/requests',{headers:{authorization:'Bearer '+customerToken}})).status,403);
   assert.ok((await anon.from('beauty_requests').select('*')).error);
   const hidden=await customer.from('beauty_requests').select('*');assert.equal(hidden.error,null);assert.deepEqual(hidden.data,[]);
   assert.ok((await customer.from('beauty_requests').insert({id:randomUUID()})).error);
   assert.ok((await customer.rpc('beauty_purge_expired_requests')).error);
   const escalation=await customer.from('profiles').update({role:'admin'}).eq('id',users[0]);assert.ok(escalation.error);
  });
  await t.test('real admin guard lists and reviews, stale transition conflicts',async()=>{
   const headers={authorization:'Bearer '+adminToken,'content-type':'application/json'};
   const r=await fetch(base+'/admin/requests',{headers});assert.equal(r.status,200,await r.clone().text());assert.equal((await r.json()).requests[0].id,input.id);
   const patch=()=>fetch(base+'/admin/requests/'+input.id,{method:'PATCH',headers,body:JSON.stringify({from:'pending',status:'reviewing'})});
   const changed=await patch();assert.equal(changed.status,200,await changed.clone().text());assert.equal((await patch()).status,409);
   const purge=await admin.rpc('beauty_purge_expired_requests');assert.equal(purge.error,null,purge.error?.message);assert.equal(Number(purge.data),0);
  });
 }finally{
  server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));
  for(const id of users)await service.auth.admin.deleteUser(id);
  for(const [key,value] of Object.entries(old)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
 }
});
