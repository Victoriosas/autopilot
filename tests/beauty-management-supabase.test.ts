import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { createBeautyRouter } from '../src/storefront/beautyRouter';

assert.equal(process.env.BEAUTY_SYNTHETIC_SUPABASE,'true','Disposable opt-in required');
assert.ok(process.env.SUPABASE_LOCAL_STATUS_FILE);
const config=JSON.parse(readFileSync(process.env.SUPABASE_LOCAL_STATUS_FILE,'utf8'));
const url=new URL(config.API_URL),databaseUrl=new URL(config.DB_URL);
assert.equal(url.protocol,'http:');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'54321');
assert.equal(databaseUrl.protocol,'postgresql:');assert.equal(databaseUrl.hostname,'127.0.0.1');assert.equal(databaseUrl.port,'54322');assert.equal(databaseUrl.pathname,'/postgres');
const publicKey=config.ANON_KEY||config.PUBLISHABLE_KEY,serviceKey=config.SERVICE_ROLE_KEY||config.SECRET_KEY;
assert.ok(publicKey&&serviceKey);
function ownerSql(sql:string){execFileSync('psql',['--no-psqlrc','--set','ON_ERROR_STOP=1','--quiet'],{input:sql,timeout:15000,stdio:['pipe','pipe','pipe'],env:{...process.env,PGHOST:databaseUrl.hostname,PGPORT:databaseUrl.port,PGDATABASE:'postgres',PGUSER:decodeURIComponent(databaseUrl.username),PGPASSWORD:decodeURIComponent(databaseUrl.password)}});}
const client=(key:string)=>createClient(url.origin,key,{auth:{persistSession:false,autoRefreshToken:false}});
const service=client(serviceKey),anon=client(publicKey);

test('Beauty management with actual disposable Auth, PostgREST and RLS',{timeout:120000},async t=>{
 const actors={customer:client(publicKey),admin:client(publicKey),practitioner:client(publicKey),other:client(publicKey)};
 const users:Record<string,string>={},tokens:Record<string,string>={};
 const keys=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_ANON_KEY','BEAUTY_REQUESTS_ENABLED','BEAUTY_CATALOG_ENABLED','BEAUTY_PROFESSIONAL_ENABLED','BEAUTY_PUBLICATION_ENABLED','PUBLIC_APP_URL'];
 const old=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 Object.assign(process.env,{SUPABASE_URL:url.origin,SUPABASE_SERVICE_ROLE_KEY:serviceKey,SUPABASE_ANON_KEY:publicKey,BEAUTY_REQUESTS_ENABLED:'true',BEAUTY_CATALOG_ENABLED:'true',BEAUTY_PROFESSIONAL_ENABLED:'true',BEAUTY_PUBLICATION_ENABLED:'true'});
 const app=express();app.use(express.json({limit:'32kb'}));app.use('/api/beauty',createBeautyRouter());
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 const origin=`http://127.0.0.1:${(server.address() as any).port}`,base=origin+'/api/beauty';process.env.PUBLIC_APP_URL=origin;
 const requestId=randomUUID(),serviceId='fixture-'+randomUUID().slice(0,8);
 let catalogVersion=1,evaluationId='';
 const serviceInput={id:serviceId,requestService:'facial',category:'Synthetic fixtures',title:'Synthetic facial',description:'Synthetic cosmetic service',durationMinutes:60,proposedPriceUyu:3600,priceApproved:false,conditions:'Synthetic visit conditions',availability:'By arrangement',available:true,publicationStatus:'draft'};
 const evaluationInput={requestId,clientDeclared:{skinType:'Synthetic declared skin',sensitivity:'Synthetic sensitivity',cosmeticReactions:'',recentTreatments:'',expectations:'Synthetic objective'},professionalNotes:{observations:'Synthetic private observations',suggestedServices:[serviceId],steps:'Synthetic steps',frequency:'By review',aftercare:'Synthetic care',referral:false},consent:true,consentVersion:'beauty-evaluation-v1',consentEvidence:'synthetic-written-record',consentRecordedAt:new Date(Date.now()-60000).toISOString(),status:'draft'};
 const call=(path:string,actor?:string,method='GET',body?:unknown)=>fetch(base+path,{method,headers:{...(actor?{authorization:'Bearer '+tokens[actor]}:{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 try{
  await t.test('real logins; practitioner membership provisioned only by local owner SQL',async()=>{
   for(const [name,actor]of Object.entries(actors)){
    const email='beauty-management-'+randomUUID()+'@example.test',password='Fixture-'+randomUUID()+'-9a!';
    const created=await service.auth.admin.createUser({email,password,email_confirm:true});assert.equal(created.error,null);users[name]=created.data.user!.id;
    const profile=await service.from('profiles').upsert({id:users[name],role:name==='admin'?'admin':'customer'});assert.equal(profile.error,null,profile.error?.message);
    const login=await actor.auth.signInWithPassword({email,password});assert.equal(login.error,null);tokens[name]=login.data.session!.access_token;
   }
   assert.ok((await actors.admin.from('beauty_practitioners').insert({user_id:users.admin,active:true})).error);
   assert.ok((await service.from('beauty_practitioners').insert({user_id:users.admin,active:true})).error);
   for(const name of ['practitioner','other']){assert.match(users[name],/^[0-9a-f-]{36}$/);ownerSql(`insert into public.beauty_practitioners(user_id,active) values ('${users[name]}',true);`);}
   assert.equal((await call('/professional/access','admin')).status,403);
   assert.equal((await call('/professional/access','customer')).status,403);
   assert.equal((await call('/professional/access','practitioner')).status,200);
  });
  await t.test('catalog drafts private, actual admin create and optimistic version conflicts',async()=>{
   assert.equal((await call('/catalog/admin/services')).status,401);
   assert.equal((await call('/catalog/admin/services','customer')).status,403);
   const created=await call('/catalog/admin/services','admin','POST',serviceInput);assert.equal(created.status,201,await created.clone().text());
   const hidden=await anon.from('beauty_services').select('id').eq('id',serviceId);assert.equal(hidden.error,null);assert.deepEqual(hidden.data,[]);
   const {id,...fields}=serviceInput;
   const payload={...fields,publicationStatus:'approved',priceApproved:true,version:catalogVersion};
   const updated=await call('/catalog/admin/services/'+serviceId,'admin','PATCH',payload);assert.equal(updated.status,200,await updated.clone().text());catalogVersion=(await updated.json()).service.version;
   assert.equal((await call('/catalog/admin/services/'+serviceId,'admin','PATCH',payload)).status,409);
  });
  await t.test('publication owner gate enforced on direct PostgREST before synthetic enablement',async()=>{
   assert.ok((await actors.admin.from('beauty_publication_control').update({enabled:true}).eq('singleton',true)).error);
   const blocked=await actors.admin.from('beauty_services').update({publication_status:'published',version:catalogVersion+1}).eq('id',serviceId);assert.ok(blocked.error,'Direct publication must require owner-controlled gate');
   // Owner-controlled local-only publication fixture is enabled below; never use hosted SQL here.
   ownerSql('update public.beauty_publication_control set enabled=true where singleton=true;');
   const {id,...fields}=serviceInput;
   const published=await call('/catalog/admin/services/'+serviceId,'admin','PATCH',{...fields,priceApproved:true,publicationStatus:'published',version:catalogVersion});assert.equal(published.status,200,await published.clone().text());catalogVersion=(await published.json()).service.version;
   const catalog=await call('/catalog');assert.equal(catalog.status,200);assert.ok((await catalog.json()).services.some((row:any)=>row.id===serviceId));
  });
  await t.test('real request stores catalog version and remains idempotent without sensitive WhatsApp content',async()=>{
   const input={id:requestId,firstName:'Synthetic',lastName:'Client',contact:'fixture@example.test',zone:'Carrasco',service:'facial',catalogServiceId:serviceId,availability:'Monday',source:'web',consent:true,consentVersion:'beauty-v1'};
   const wrongOrigin=await fetch(base+'/requests',{method:'POST',headers:{'content-type':'application/json',origin:'https://untrusted.example'},body:JSON.stringify(input)});assert.equal(wrongOrigin.status,403);
   const response=await call('/requests',undefined,'POST',input);assert.equal(response.status,202,await response.clone().text());const receipt=await response.json();assert(!decodeURIComponent(receipt.whatsappUrl).includes(input.contact));
   assert.equal((await call('/requests',undefined,'POST',input)).status,202);
   assert.equal((await call('/requests',undefined,'POST',{...input,zone:'Solymar'})).status,409);
   const row=await service.from('beauty_requests').select('catalog_service_id,catalog_version,catalog_snapshot').eq('id',requestId).single();assert.equal(row.error,null);assert.equal(row.data!.catalog_service_id,serviceId);assert.equal(row.data!.catalog_version,catalogVersion);assert.equal(row.data!.catalog_snapshot.title,serviceInput.title);assert.equal(row.data!.catalog_snapshot.duration_minutes,60);assert.equal(Number(row.data!.catalog_snapshot.price_uyu),3600);
   const {id,...fields}=serviceInput;
   const revised=await call('/catalog/admin/services/'+serviceId,'admin','PATCH',{...fields,title:'Synthetic revised service',publicationStatus:'draft',priceApproved:false,version:catalogVersion});assert.equal(revised.status,200,await revised.clone().text());
   const crm=await call('/admin/requests','admin');assert.equal(crm.status,200);const saved=(await crm.json()).requests.find((item:any)=>item.id===requestId);assert.equal(saved.catalog_snapshot.title,serviceInput.title);assert.equal(saved.catalog_version,catalogVersion);
  });
  await t.test('evaluation isolated from CRM/service role, consent and ownership enforced',async()=>{
   assert.equal((await call('/professional/evaluations?requestId='+requestId,'admin')).status,403);
   assert.ok((await service.from('beauty_evaluations').select('*')).error);
   assert.ok((await anon.from('beauty_evaluations').select('*')).error);
   assert.ok((await actors.admin.from('beauty_evaluations').select('*')).data?.length===0);
   assert.equal((await call('/professional/evaluations','practitioner','POST',{...evaluationInput,consent:false})).status,400);
   const created=await call('/professional/evaluations','practitioner','POST',evaluationInput);assert.equal(created.status,201,await created.clone().text());const row=(await created.json()).evaluation;evaluationId=row.id;assert.equal(row.version,1);
   const read=await call('/professional/evaluations?requestId='+requestId,'practitioner');assert.equal(read.status,200);assert.equal(read.headers.get('cache-control'),'no-store');assert.equal(read.headers.get('referrer-policy'),'no-referrer');assert.equal((await read.json()).evaluation.id,evaluationId);
   const other=await call('/professional/evaluations?requestId='+requestId,'other');assert.equal(other.status,200);assert.equal((await other.json()).evaluation,null);
   const patch={...evaluationInput,professionalNotes:{...evaluationInput.professionalNotes,observations:'Synthetic revised observations'},version:1};
   const updated=await call('/professional/evaluations/'+evaluationId,'practitioner','PATCH',patch);assert.equal(updated.status,200,await updated.clone().text());assert.equal((await updated.json()).evaluation.version,2);
   assert.equal((await call('/professional/evaluations/'+evaluationId,'practitioner','PATCH',patch)).status,409);
   assert.equal((await call('/professional/evaluations/'+evaluationId,'other','PATCH',{...patch,version:2})).status,409);
   const finalized=await call('/professional/evaluations/'+evaluationId,'practitioner','PATCH',{...patch,status:'finalized',version:2});assert.equal(finalized.status,200,await finalized.clone().text());
   assert.equal((await call('/professional/evaluations/'+evaluationId,'practitioner','PATCH',{...patch,version:3})).status,409);
  });
 }finally{
  server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));
  ownerSql(`delete from public.beauty_requests where id='${requestId}'; delete from public.beauty_services where id='${serviceId}'; delete from public.beauty_practitioners where user_id in (${Object.values(users).map(id=>`'${id}'`).join(',')||'null'}); update public.beauty_publication_control set enabled=false where singleton=true;`);
  for(const id of Object.values(users))await service.auth.admin.deleteUser(id);
  for(const [key,value]of Object.entries(old)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
 }
});
