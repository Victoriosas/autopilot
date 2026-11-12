// Real local Supabase Auth/PostgREST/RLS. Never runs against hosted services.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import express from 'express';
import { once } from 'node:events';
import { registerConsultationMaterialAdmin } from '../src/storefront/consultationMaterialAdminRouter';
import { createClient } from '@supabase/supabase-js';
import { persistConsultationMaterial } from '../src/storefront/consultationMaterial';
import { composeGroundedConsultation } from '../src/storefront/consultationGroundedComposer';
import { createMaterialStore } from '../src/storefront/consultationMaterialStore';
import { createMaterialAdminStore } from '../src/storefront/consultationMaterialAdmin';
import type { ConsultationInput } from '../src/storefront/consultationRequest';
assert.equal(process.env.BEAUTY_SYNTHETIC_SUPABASE,'true');
const config=JSON.parse(readFileSync(process.env.SUPABASE_LOCAL_STATUS_FILE!,'utf8'));
assert.equal(config.API_URL,'http://127.0.0.1:54321');
const db=new URL(config.DB_URL);assert.equal(db.protocol,'postgresql:');assert.equal(db.hostname,'127.0.0.1');assert.equal(db.port,'54322');assert.equal(db.pathname,'/postgres');
const publicKey=config.ANON_KEY||config.PUBLISHABLE_KEY, serviceKey=config.SERVICE_ROLE_KEY||config.SECRET_KEY;
const client=(key:string)=>createClient(config.API_URL,key,{auth:{persistSession:false,autoRefreshToken:false}});
const service=client(serviceKey),anon=client(publicKey);
const ownerSql=(query:string)=>execFileSync('psql',['-X','-q','-v','ON_ERROR_STOP=1'],{input:query,stdio:['pipe','pipe','pipe'],timeout:15000,env:{...process.env,PGHOST:db.hostname,PGPORT:db.port,PGDATABASE:'postgres',PGUSER:decodeURIComponent(db.username),PGPASSWORD:decodeURIComponent(db.password)}});
test('Cycle C real local JWT admin/customer and service restrictions', {timeout:120000},async()=>{
 const envKeys=['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY'];const old=Object.fromEntries(envKeys.map(key=>[key,process.env[key]]));
 Object.assign(process.env,{SUPABASE_URL:config.API_URL,SUPABASE_ANON_KEY:publicKey,SUPABASE_SERVICE_ROLE_KEY:serviceKey});
 const actors:Record<string,{id:string;token:string;db:ReturnType<typeof client>}>={};
 const input:ConsultationInput={id:randomUUID(),fullName:'Caso sintético',phone:'00000000',email:'',age:null,service:'orientacion',message:'¿Me pueden mandar información por correo?',responseChannel:'whatsapp',consent:true,consentVersion:'consultation-v1',website:''};
 try{
  for(const role of ['admin','customer']){
   const email='material-'+randomUUID()+'@example.test',password='Synthetic-'+randomUUID()+'-9a!';
   const created=await service.auth.admin.createUser({email,password,email_confirm:true});assert.equal(created.error,null);const id=created.data.user!.id;
   assert.equal((await service.from('profiles').upsert({id,role})).error,null);
   const db=client(publicKey),login=await db.auth.signInWithPassword({email,password});assert.equal(login.error,null);actors[role]={id,token:login.data.session!.access_token,db};
  }
  const hash=createHash('sha256').update(input.id).digest('hex');
  const claim=await service.rpc('consultation_claim',{p_input:input,p_fingerprint:hash,p_abuse_hash:hash});assert.equal(claim.error,null);assert.equal(claim.data.state,'send');
  const draft=composeGroundedConsultation(input),operation=randomUUID();
  const results=await Promise.all(Array.from({length:4},()=>persistConsultationMaterial(input,draft,operation,{token:actors.admin.token})));
  assert.ok(results.every(result=>result.state==='persisted'));assert.equal(new Set(results.map(result=>(result as any).id)).size,1);
  const store=createMaterialStore(),id=(results[0] as any).id;
  const adminStore=createMaterialAdminStore();
  const snapshot=await adminStore.snapshot(actors.admin.token,input.id);assert.equal(snapshot.length,1);assert.equal(snapshot[0].available,true);
  for(const token of [actors.customer.token,'invalid-synthetic-token'])await assert.rejects(adminStore.snapshot(token,input.id));
  for(const db of [anon,service])assert.ok((await db.rpc('consultation_material_admin_snapshot',{p_request:input.id})).error);
  const resultsD=await Promise.all(['reviewed','rejected'].map(state=>adminStore.review(actors.admin.token,input.id,id,snapshot[0].updated_at,state)));
  assert.deepEqual(resultsD.sort(),[false,true]);
  const app=express(),router=express.Router();registerConsultationMaterialAdmin(router,()=> 'https://victoriosas.online');app.use(router);
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  const url=`http://127.0.0.1:${(server.address() as any).port}/admin/${input.id}/material`;
  try {
   assert.equal((await fetch(url)).status,401);
   assert.equal((await fetch(url,{headers:{authorization:'Bearer invalid-synthetic-token'}})).status,401);
   assert.equal((await fetch(url,{headers:{authorization:'Bearer '+actors.customer.token}})).status,403);
   const response=await fetch(url,{headers:{authorization:'Bearer '+actors.admin.token}});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
   assert.equal((await response.json()).rows[0].delivery_decision,'no_send');
  } finally {server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
  assert.equal((await store.list(actors.admin.token,input.id)).length,1);assert.deepEqual(await store.list(actors.customer.token,input.id),[]);
  assert.equal((await persistConsultationMaterial(input,draft,randomUUID(),{token:actors.customer.token})).state,'unavailable');
  assert.equal((await persistConsultationMaterial(input,draft,randomUUID(),{token:'invalid-synthetic-token'})).state,'unavailable');
  assert.ok((await anon.from('consultation_material_requests').select('*')).error);
  assert.ok((await service.from('consultation_material_requests').select('*')).error);
  assert.ok((await actors.customer.db.rpc('consultation_material_purge')).error);
  assert.ok((await actors.admin.db.from('consultation_material_requests').update({delivery_decision:'send'}).eq('id',id)).error);
  assert.equal(await store.review(actors.admin.token,id,'reviewed'),true);
  assert.equal(((await store.list(actors.admin.token,input.id))[0] as any).delivery_decision,'no_send');
  assert.equal(await store.review(actors.admin.token,id,'revoked'),true);assert.deepEqual(await store.list(actors.admin.token,input.id),[]);
  const revoked=(await adminStore.snapshot(actors.admin.token,input.id))[0];assert.equal(revoked.metadata,null);assert.equal(revoked.available,false);assert.equal(revoked.review_state,'revoked');
  assert.equal((await persistConsultationMaterial(input,draft,operation,{token:actors.admin.token})).state,'unavailable');
  assert.equal(await adminStore.purge(actors.admin.token,input.id),1);assert.deepEqual(await adminStore.snapshot(actors.admin.token,input.id),[]);
  assert.equal((await persistConsultationMaterial(input,draft,operation,{token:actors.admin.token})).state,'unavailable');
 }finally{
  try{ownerSql(`delete from public.consultation_requests where id='${input.id}'`);}finally{
   for(const actor of Object.values(actors)){await actor.db.auth.signOut();await service.auth.admin.deleteUser(actor.id);}
   for(const key of envKeys){if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];}
  }
 }
});
