import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import express from 'express';
import {createBeautyRouter,type BeautyStore} from '../src/storefront/beautyRouter';
import {serviceGroups,serviceSlug} from '../src/components/public/serviceDirectory';
const database=process.env.BEAUTY_TEST_DATABASE_URL;
if(!database) throw Error('Run scripts/test-beauty-postgres.mjs');
const target=new URL(database);assert.equal(target.hostname,'127.0.0.1');assert.ok(['/victoriosa_beauty_test','/victoriosa_beauty_privileges_test'].includes(target.pathname));
function sql(query:string):Promise<string>{return new Promise((resolve,reject)=>{const child=execFile(process.env.PSQL_PATH||'psql',[database!,'-X','-q','-A','-t','-v','ON_ERROR_STOP=1'],{windowsHide:true},(error,out,err)=>error?reject(Error(err)):resolve(out.trim()));child.stdin!.end(query);});}
const admin='11111111-1111-4111-8111-111111111111',customer='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';
const actor=(uid:string)=>`set role authenticated;set request.jwt.claim.sub='${uid}';`;
test('Beauty real PostgreSQL privileges, RLS and transitions',{timeout:120000},async t=>{
 await sql(`do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls;end if;end$$;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create table public.profiles(id uuid primary key,role text);insert into profiles values('${admin}','admin'),('${customer}','customer');grant select on profiles to authenticated;`);
 const migration='supabase/legacy-migrations/20261017220000_beauty_requests.sql';if(existsSync(migration)) await sql(readFileSync(migration,'utf8'));
 const retentionMigration='supabase/legacy-migrations/20261017221000_beauty_retention.sql';if(existsSync(retentionMigration)) await sql(readFileSync(retentionMigration,'utf8'));
 const insert=`insert into public.beauty_requests(id,fingerprint,first_name,last_name,contact,zone,service,availability,source,consent_version) values('${id}',repeat('a',64),'Synthetic','Test','test@example.test','Carrasco','facial','Monday','web','beauty-v1')`;
 await t.test('service creates pending record and cannot read via anon',async()=>{await sql(`set role service_role;${insert};`);assert.equal(await sql('set role service_role;select status from beauty_requests;'),'pending');await assert.rejects(sql('set role anon;select * from beauty_requests'),/permission denied/);});
 await t.test('customer cannot read, insert, delete or change contact',async()=>{assert.equal(await sql(`${actor(customer)}select count(*) from beauty_requests;`),'0');for(const query of [insert,'delete from beauty_requests',"update beauty_requests set contact='other'"]) await assert.rejects(sql(actor(customer)+query),/permission denied/);assert.equal(await sql(`${actor(customer)}update beauty_requests set status='reviewing',reviewed_by='${customer}';select count(*) from beauty_requests;`),'0');});
 await t.test('admin transitions require actor and reject skips/replay',async()=>{await assert.rejects(sql(`${actor(admin)}update beauty_requests set status='confirmed',reviewed_by='${admin}';`),/BEAUTY_TRANSITION_INVALID/);await assert.rejects(sql(`${actor(admin)}update beauty_requests set status='reviewing',reviewed_by='${customer}';`),/BEAUTY_REVIEW_ACTOR_INVALID/);await sql(`${actor(admin)}update beauty_requests set status='reviewing',reviewed_by='${admin}';`);await assert.rejects(sql(`${actor(admin)}update beauty_requests set status='reviewing',reviewed_by='${admin}';`),/BEAUTY_TRANSITION_INVALID/);await sql(`${actor(admin)}update beauty_requests set status='confirmed',reviewed_by='${admin}';update beauty_requests set status='completed',reviewed_by='${admin}';`);await assert.rejects(sql(`${actor(admin)}update beauty_requests set status='cancelled',reviewed_by='${admin}';`),/BEAUTY_TRANSITION_INVALID/);});
 await t.test('service cannot update and expired rows hidden from admin',async()=>{await assert.rejects(sql("set role service_role;update beauty_requests set status='pending'"),/permission denied/);await sql(`update beauty_requests set created_at=now()-interval '91 days',expires_at=now()-interval '1 day';`);assert.equal(await sql(`${actor(admin)}select count(*) from beauty_requests;`),'0');});
 await t.test('contact limit and duplicate replay under service privileges',async()=>{
  await sql(`truncate beauty_requests;set role service_role;${insert};${insert} on conflict(id) do nothing;`);
  for(const suffix of ['334','335']) await sql(`set role service_role;${insert.replace(id,id.slice(0,-3)+suffix)};`);
  await assert.rejects(sql(`set role service_role;${insert.replace(id,id.slice(0,-3)+'336')}`),/BEAUTY_CONTACT_RATE_LIMIT/);
  assert.equal(await sql('set role service_role;select count(*) from beauty_requests'),'3');
 });
 await t.test('real HTTP intake and admin review backed by PostgreSQL (fixture authentication)',async()=>{
  await sql('truncate beauty_requests');
  const q=(v:string)=>`'${v.replace(/'/g,"''")}'`;
  const store:BeautyStore={
   async create(input){
    const {id,consent,...fields}=input;
    const fingerprint=createHash('sha256').update(JSON.stringify(fields)).digest('hex');
    await sql(`set role service_role;insert into beauty_requests(id,fingerprint,first_name,last_name,contact,zone,service,availability,source,consent_version) values(${[id,fingerprint,input.firstName,input.lastName,input.contact,input.zone,input.service,input.availability,input.source,input.consentVersion].map(q).join(',')}) on conflict(id) do nothing;`);
    const row=JSON.parse(await sql(`set role service_role;select row_to_json(b) from (select id,status,fingerprint from beauty_requests where id=${q(id)}) b;`));
    if(row.fingerprint!==fingerprint)throw Error('BEAUTY_IDEMPOTENCY_CONFLICT');return row;
   },
   async list(_token,offset){return JSON.parse(await sql(`${actor(admin)}select coalesce(json_agg(b),'[]') from (select * from beauty_requests order by created_at desc limit 50 offset ${offset}) b;`));},
   async update(_token,recordId,from,to,reviewer){return (await sql(`${actor(reviewer)}with changed as(update beauty_requests set status=${q(to)},reviewed_by=${q(reviewer)} where id=${q(recordId)} and status=${q(from)} returning id) select count(*) from changed;`))==='1';}
  };
  const app=express();app.use(express.json());
  // Explicit fixture middleware: no Supabase Auth claim is made by this test.
  app.use('/api/beauty',createBeautyRouter({store,enabled:()=>true,auth:(req,res,next)=>{if(req.get('authorization')!=='Bearer fixture-admin')return res.status(401).json({error:'FIXTURE_AUTH_REQUIRED'});res.locals.adminUserId=admin;next();}}));
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const address=server.address();assert.ok(address&&typeof address==='object');const base=`http://127.0.0.1:${address.port}/api/beauty`;
  const body={id,firstName:'Synthetic',lastName:'Client',contact:'synthetic@example.test',zone:'Carrasco',service:'facial',availability:'Monday',source:'web',consent:true,consentVersion:'beauty-v1'};
  try{
   const post=()=>fetch(base+'/requests',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
   const response=await post();assert.equal(response.status,202);const receipt=await response.json();assert.equal(receipt.id,id);assert.doesNotMatch(decodeURIComponent(receipt.whatsappUrl),/synthetic@example|Carrasco|Synthetic/);
   assert.equal((await post()).status,202);assert.equal(await sql('set role service_role;select count(*) from beauty_requests'),'1');
   assert.equal((await fetch(base+'/admin/requests')).status,401);
   const headers={'authorization':'Bearer fixture-admin','content-type':'application/json'};
   const list=await fetch(base+'/admin/requests',{headers});assert.equal(list.status,200);assert.equal((await list.json()).requests[0].status,'pending');
   const change=()=>fetch(base+'/admin/requests/'+id,{method:'PATCH',headers,body:JSON.stringify({from:'pending',status:'reviewing'})});
   assert.equal((await change()).status,200);assert.equal((await change()).status,409);assert.equal(await sql(`${actor(admin)}select status from beauty_requests where id='${id}'`),'reviewing');
  }finally{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
 });
 await t.test('retention RPC denies public/customer and deletes only expired rows for admin',async()=>{
  await sql(`insert into beauty_requests(id,fingerprint,first_name,last_name,contact,zone,service,availability,source,consent_version,created_at,expires_at) select '44444444-4444-4444-8444-444444444444',fingerprint,first_name,last_name,contact,zone,service,availability,source,consent_version,now()-interval '91 days',now()-interval '1 day' from beauty_requests where id='${id}';`);
  await assert.rejects(sql('set role anon;select public.beauty_purge_expired_requests();'),/permission denied/);
  await assert.rejects(sql(`${actor(customer)}select public.beauty_purge_expired_requests();`),/BEAUTY_ADMIN_REQUIRED/);
  await assert.rejects(sql("set role authenticated;select public.beauty_purge_expired_requests();"),/BEAUTY_ADMIN_REQUIRED/);
  assert.equal(await sql('select count(*) from beauty_requests'),'2');
  assert.equal(await sql(`${actor(admin)}select public.beauty_purge_expired_requests();`),'1');
  assert.equal(await sql(`${actor(admin)}select public.beauty_purge_expired_requests();`),'0');
  assert.equal(await sql(`select id from beauty_requests`),id);
 });
 await t.test('knowledge migration preserves four legacy services and adds exactly the 17 public names as drafts',async()=>{
  await sql(readFileSync('supabase/legacy-migrations/20261017230000_beauty_catalog_evaluations.sql','utf8'));
  const before=await sql('select json_agg(row_to_json(s) order by id) from beauty_services s');
  await sql(readFileSync('supabase/legacy-migrations/20261104030000_consultation_service_knowledge.sql','utf8'));
  const expected=serviceGroups.flatMap(g=>g.services.map(title=>({id:serviceSlug(title),title}))).sort((a,b)=>a.id.localeCompare(b.id));
  const actual=JSON.parse(await sql("select json_agg(json_build_object('id',id,'title',title) order by id) from beauty_services where id not in ('facial','massage','ritual','consultation')"));
  assert.deepEqual(actual.sort((a:any,b:any)=>a.id.localeCompare(b.id)),expected);
  assert.equal(expected.length,17);assert.equal(await sql('select count(*) from beauty_services'),'21');
  assert.equal(await sql("select json_agg(row_to_json(s) order by id) from beauty_services s where id in ('facial','massage','ritual','consultation')"),before);
  assert.equal(await sql("select count(*) from beauty_services where publication_status<>'draft' or price_approved or proposed_price_uyu is not null or duration_minutes is not null or available or description<>''"),'0');
 });
 await t.test('public retention RPC is invoker-only and preserves admin-only expired deletion',async()=>{
  await sql(readFileSync('supabase/legacy-migrations/20261104041706_beauty_retention_private_rpc.sql','utf8'));
  assert.equal(await sql("select prosecdef from pg_proc where oid='public.beauty_purge_expired_requests()'::regprocedure"),'f');
  assert.equal(await sql("select prosecdef from pg_proc where oid='private.beauty_purge_expired_requests()'::regprocedure"),'t');
  for(const role of ['anon','service_role'])for(const schema of ['public','private'])await assert.rejects(sql(`set role ${role};select ${schema}.beauty_purge_expired_requests()`),/permission denied/);
  for(const schema of ['public','private'])await assert.rejects(sql(`${actor(customer)}select ${schema}.beauty_purge_expired_requests()`),/BEAUTY_ADMIN_REQUIRED/);
  await assert.rejects(sql('set role authenticated;select public.beauty_purge_expired_requests()'),/BEAUTY_ADMIN_REQUIRED/);
  assert.equal(await sql(`${actor(admin)}select public.beauty_purge_expired_requests()`),'0');
  await sql(`insert into beauty_requests(id,fingerprint,first_name,last_name,contact,zone,service,availability,source,consent_version,created_at,expires_at) select '55555555-5555-4555-8555-555555555555',fingerprint,first_name,last_name,contact,zone,service,availability,source,consent_version,now()-interval '91 days',now()-interval '1 day' from beauty_requests where id='${id}'`);
  assert.equal(await sql(`${actor(admin)}select public.beauty_purge_expired_requests()`),'1');
  assert.equal(await sql('select count(*) from beauty_requests'),'1');
 });
 await t.test('knowledge is private and RLS enabled; only approved descriptions reach AI, never internal fees',async()=>{
  assert.equal(await sql("select relrowsecurity from pg_class where oid='private.consultation_service_knowledge'::regclass"),'t');
  for(const role of ['anon','authenticated','service_role'])await assert.rejects(sql(`set role ${role};select * from private.consultation_service_knowledge`),/permission denied/);
  await assert.rejects(sql(`${actor(customer)}select consultation_knowledge_list()`),/ADMIN_REQUIRED/);
  for(const role of ['anon','authenticated'])await assert.rejects(sql(`set role ${role};select consultation_knowledge_facts()`),/permission denied/);
  const entry={slug:'limpieza-profunda',version:0,description:'Descripción exclusivamente sintética para validar permisos.',techniques:'',duration:'',conditions:'',faq:'',internalFee:'Tarifa interna sintética 1234 UYU',approvedForAI:false,priceApproved:true,validUntil:null};
  const save=(value:unknown)=>sql(`${actor(admin)}select consultation_knowledge_save('${JSON.stringify(value).replace(/'/g,"''")}'::jsonb)`);
  assert.equal(await save(entry),'t');
  assert.equal(await sql('set role service_role;select consultation_knowledge_facts()'),'[]');
  assert.equal(await save({...entry,version:1,approvedForAI:true}),'t');
  const facts=await sql('set role service_role;select consultation_knowledge_facts()');
  assert.equal(JSON.parse(facts).length,1);assert.doesNotMatch(facts,/1234|internalFee|priceApproved|UYU/);
  assert.equal(await save({...entry,version:1,description:'Versión desactualizada.'}),'f');
  assert.equal(await save({...entry,version:2}),'t');
  assert.equal(await sql('set role service_role;select consultation_knowledge_facts()'),'[]','new unapproved revision invalidates old approval');
  assert.equal(await save({...entry,version:3,approvedForAI:true,validUntil:new Date(Date.now()+86400000).toISOString()}),'t');
  await sql("update private.consultation_service_knowledge set entry=jsonb_set(entry,'{validUntil}',to_jsonb((now()-interval '1 day')::text)) where version=4");
  assert.equal(await sql('set role service_role;select consultation_knowledge_facts()'),'[]','expired approvals cannot reach AI');
  assert.equal(await save({...entry,version:4,approvedForAI:true,description:'Garantiza resultados sin riesgos.'}),'t');
  assert.equal(await sql('set role service_role;select consultation_knowledge_facts()'),'[]','approval cannot override deterministic safety');
 });
});
