import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {readFileSync} from 'node:fs';
const database=process.env.BEAUTY_TEST_DATABASE_URL;
if(!database)throw Error('Run scripts/test-beauty-catalog-postgres.mjs');
const target=new URL(database);assert.equal(target.hostname,'127.0.0.1');assert.equal(target.pathname,'/victoriosa_beauty_test');
function sql(query:string):Promise<string>{return new Promise((resolve,reject)=>{const child=execFile(process.env.PSQL_PATH||'psql',[database!,'-X','-q','-A','-t','-v','ON_ERROR_STOP=1'],{windowsHide:true},(error,out,err)=>error?reject(Error(err)):resolve(out.trim()));child.stdin!.end(query);});}
const admin='11111111-1111-4111-8111-111111111111',practitioner='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333',request='44444444-4444-4444-8444-444444444444';
const actor=(uid:string)=>`set role authenticated;set request.jwt.claim.sub='${uid}';`;
test('Beauty catalog and isolated professional evaluations: real PostgreSQL',{timeout:120000},async t=>{
 await sql(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create table profiles(id uuid primary key,role text);insert into profiles values('${admin}','admin'),('${practitioner}','customer'),('${other}','customer');grant select on profiles to authenticated;`);
 await sql(readFileSync('supabase/migrations/20261017220000_beauty_requests.sql','utf8'));
 await sql(readFileSync('supabase/migrations/20261017230000_beauty_catalog_evaluations.sql','utf8'));
 await t.test('database owner publication gate cannot be bypassed by admin or service role',async()=>{
  await assert.rejects(sql(`${actor(admin)}update beauty_services set publication_status='published',version=2 where id='facial'`),/BEAUTY_PUBLICATION_DISABLED/);
  await assert.rejects(sql(`${actor(admin)}update beauty_publication_control set enabled=true`),/permission denied/);
  await assert.rejects(sql('set role service_role;update beauty_publication_control set enabled=true'),/permission denied/);
  assert.equal(await sql('set role anon;select private.beauty_publication_enabled()'),'f');
  await sql('update beauty_publication_control set enabled=true');
 }); await t.test('catalog publication requires approved complete offering and public sees published only',async()=>{
  await sql(`${actor(admin)}update beauty_services set title='Facial',version=2 where id='facial';`);
  assert.equal(await sql('set role anon;select count(*) from beauty_services'),'0');
  await assert.rejects(sql(`${actor(admin)}update beauty_services set publication_status='published',version=3 where id='facial';`),/BEAUTY_PUBLICATION_INCOMPLETE/);
  await sql(`${actor(admin)}update beauty_services set description='Cosmetic facial care',duration_minutes=75,proposed_price_uyu=3600,price_approved=true,conditions='Subject to prior evaluation',availability='By appointment',publication_status='published',version=3 where id='facial';`);
  assert.equal(await sql('set role anon;select count(*) from beauty_services'),'0');
  await assert.rejects(sql(`${actor(other)}insert into beauty_services(id,request_service,category,title)values('other','massage','massage','Massage')`),/row-level security/);
 });
 await t.test('request catalog reference enforces approved availability and snapshot version',async()=>{
  const attempt=`insert into beauty_requests(id,fingerprint,first_name,last_name,contact,zone,service,consent_version,catalog_service_id,catalog_version,catalog_snapshot)values('55555555-5555-4555-8555-555555555555',repeat('b',64),'Synthetic','Catalog','catalog@example.test','Carrasco','facial','beauty-v1','facial',3,'{"title":"FORGED"}')`;
  await assert.rejects(sql('set role service_role;'+attempt),/BEAUTY_CATALOG_UNAVAILABLE/);
  await sql(`${actor(admin)}update beauty_services set available=true,version=4 where id='facial'`);
  await assert.rejects(sql('set role service_role;'+attempt),/BEAUTY_CATALOG_UNAVAILABLE/);
  assert.equal(await sql('set role anon;select count(*) from beauty_services'),'1');
  await sql('set role service_role;'+attempt.replace(",'facial',3,",",'facial',4,"));
  await assert.rejects(sql(`${actor(admin)}update beauty_services set title='Changed',version=5 where id='facial'`),/BEAUTY_REAPPROVAL_REQUIRED/);
  await sql(`${actor(admin)}update beauty_services set title='Changed',publication_status='pending',price_approved=false,version=5 where id='facial'`);
  assert.equal(await sql('set role anon;select count(*) from beauty_services'),'0');
 });
 await t.test('request stores immutable historical catalog terms and ignores supplied snapshot',async()=>{
  const snapshot=JSON.parse(await sql("select catalog_snapshot from beauty_requests where catalog_service_id='facial'"));
  assert.equal(snapshot.title,'Facial');assert.equal(snapshot.price_uyu,3600);assert.equal(snapshot.duration_minutes,75);
  assert.equal(await sql("select catalog_snapshot->>'title' from beauty_requests where catalog_service_id='facial'"),'Facial');
 }); await sql(`insert into beauty_requests(id,fingerprint,first_name,last_name,contact,zone,service,consent_version)values('${request}',repeat('a',64),'Synthetic','Client','test@example.test','Carrasco','facial','beauty-v1');insert into beauty_practitioners values('${practitioner}',true),('${other}',true);`);
 const insert=`insert into beauty_evaluations(request_id,practitioner_id,consent_version,consent_recorded_at,consent_evidence)values('${request}','${practitioner}','beauty-evaluation-v1',now(),'Written form ref SYNTHETIC-001')`;
 await t.test('CRM admin and service role cannot access evaluations or grant practitioner access',async()=>{
  await assert.rejects(sql('set role service_role;select * from beauty_evaluations'),/permission denied/);
  await assert.rejects(sql('set role anon;select * from beauty_evaluations'),/permission denied/);
  assert.equal(await sql(`${actor(admin)}select count(*) from beauty_evaluations`),'0');
  await assert.rejects(sql(`${actor(admin)}insert into beauty_practitioners values('${admin}',true)`),/permission denied/);
  await assert.rejects(sql(actor(admin)+insert),/row-level security/);
 });
 await t.test('consent is mandatory, assigned practitioner owns visibility and strict JSON is bounded',async()=>{
  await assert.rejects(sql(actor(practitioner)+insert.replace("'beauty-evaluation-v1'","''")),/constraint/);
  await sql(actor(practitioner)+insert);
  assert.equal(await sql(`${actor(practitioner)}select count(*) from beauty_evaluations`),'1');
  assert.equal(await sql(`${actor(other)}select count(*) from beauty_evaluations`),'0');
  await assert.rejects(sql(`${actor(practitioner)}update beauty_evaluations set client_declared='{"diagnosis":"x"}',version=2`),/BEAUTY_EVALUATION_CONTENT_INVALID/);
  await assert.rejects(sql(`${actor(practitioner)}update beauty_evaluations set professional_notes='{"observations":5}',version=2`),/BEAUTY_EVALUATION_CONTENT_INVALID/);
 });
 await t.test('version guards replay, finalized records immutable, inactive practitioner loses access',async()=>{
  await assert.rejects(sql(`${actor(practitioner)}update beauty_evaluations set client_declared='{"skinType":"dry"}'`),/BEAUTY_VERSION_CONFLICT/);
  await sql(`${actor(practitioner)}update beauty_evaluations set professional_notes='{"observations":"Cosmetic consultation","suggestedServices":["facial"],"steps":"Discuss options","aftercare":"Gentle care","referral":false}',status='finalized',version=2`);
  await assert.rejects(sql(`${actor(practitioner)}update beauty_evaluations set status='draft',version=3`),/BEAUTY_EVALUATION_FINALIZED/);
  await sql(`update beauty_practitioners set active=false where user_id='${practitioner}'`);
  assert.equal(await sql(`${actor(practitioner)}select count(*) from beauty_evaluations`),'0');
 });
 await t.test('parent retention deletion also removes private evaluation',async()=>{
  assert.equal(await sql('select count(*) from beauty_evaluations'),'1');
  assert.equal(await sql(`${actor(admin)}select count(*) from beauty_evaluations`),'0');
  await assert.rejects(sql('set role service_role;select professional_notes from beauty_evaluations'),/permission denied/);
  await sql(`delete from beauty_requests where id='${request}'`);
  assert.equal(await sql('select count(*) from beauty_evaluations'),'0');
 });});
