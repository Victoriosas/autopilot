import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { composeGroundedConsultation } from '../src/storefront/consultationGroundedComposer';
import { persistConsultationMaterial } from '../src/storefront/consultationMaterial';
import type { MaterialStore, MaterialPayload } from '../src/storefront/consultationMaterialStore';
import type { ConsultationInput } from '../src/storefront/consultationRequest';
const database = process.env.MATERIAL_TEST_DATABASE_URL!;
const target = new URL(database);
assert.equal(target.hostname, '127.0.0.1'); assert.equal(target.pathname, '/victoriosa_material_test');
function sql(query: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(process.env.PSQL_PATH || 'psql', [database, '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], { windowsHide: true }, (error, output, stderr) => error ? reject(Error(stderr)) : resolve(output.trim()));
    child.stdin!.end(query);
  });
}
const literal = (value: unknown) => "'" + JSON.stringify(value).replace(/'/g, "''") + "'::jsonb";
const admin = '11111111-1111-4111-8111-111111111111', customer = '22222222-2222-4222-8222-222222222222';
const actor = (id = admin) => `set role authenticated;set request.jwt.claim.sub='${id}';`;
const input = (message = '¿Me pueden mandar toda la información por correo?'): ConsultationInput => ({ id: randomUUID(), fullName: 'Caso sintético', phone: '00000000', email: '', age: null, service: 'orientacion', message, responseChannel: 'whatsapp', consent: true, consentVersion: 'consultation-v1', website: '' });
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const store: MaterialStore = {
  context: async (token, id) => JSON.parse(await sql(`${actor(token)}select consultation_material_context('${id}')`)),
  save: async (token, id, operation, payload) => JSON.parse(await sql(`${actor(token)}select consultation_material_save('${id}','${operation}',${literal(payload)})`)),
  list: async (token, id) => JSON.parse(await sql(`${actor(token)}select coalesce(json_agg(m),'[]') from consultation_material_requests m where request_id='${id}'`)),
  review: async (token, id, state) => (await sql(`${actor(token)}select consultation_material_review('${id}','${state}')`)) === 't',
  purge: async token => Number(await sql(`${actor(token)}select consultation_material_purge()`)),
};
const admit = (value: ConsultationInput) => sql(`set role service_role;select consultation_claim(${literal(value)},'${digest(value.id)}','${digest(value.id + 'abuse')}')`);

test('Cycle C real PostgreSQL migration, RLS, concurrency, consent, retention and rollback', { timeout: 120000 }, async t => {
  await sql(`do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls;end if;end$$;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;create table profiles(id uuid primary key,role text);grant select on profiles to authenticated;insert into profiles values('${admin}','admin'),('${customer}','customer');`);
  await sql(readFileSync('supabase/legacy-migrations/20261023042129_consultation_private_outbox.sql','utf8'));
  await sql('create table beauty_services(id text primary key,request_service text,category text,title text)');
  await sql(readFileSync('supabase/migrations/20261104045138_consultation_service_knowledge.sql','utf8'));
  const migration = readFileSync('supabase/staged/consultation_material_requests_v1.sql','utf8');
  const rollback = readFileSync('supabase/staged/rollback/consultation_material_requests_v1.sql','utf8');
  await sql(migration);
  await sql(readFileSync('supabase/staged/consultation_material_admin_v1.sql','utf8'));
  const value = input(), draft = composeGroundedConsultation(value), operation = randomUUID();
  await admit(value);
  let id = '';
  await t.test('concurrent retries persist one record, one event and stable identifier', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => persistConsultationMaterial(value,draft,operation,{ token: admin,store })));
    assert.ok(results.every(result => result.state === 'persisted'), JSON.stringify(results));
    id = (results[0] as any).id; assert.equal(new Set(results.map(result => (result as any).id)).size,1);
    assert.equal(await sql(`select count(*) from consultation_material_requests where request_id='${value.id}'`),'1');
    assert.equal(await sql(`select count(*) from consultation_material_events where material_id='${id}'`),'1');
    const rows = await store.list(admin,value.id); assert.equal(rows.length,1);
    const saved = rows[0] as any; assert.equal(saved.payload.sources.length,17); assert.equal(saved.consent_state,'granted');
    assert.equal(saved.delivery_decision,'no_send'); assert.ok(!JSON.stringify(saved.payload).includes(value.fullName));
    assert.ok(Date.parse(saved.expires_at) <= Date.now()+7*86400000);
  });
  await t.test('Cycle D minimum snapshot, CAS concurrency, revoked/expired redaction and scoped purge', async () => {
    const next=input();await admit(next);const op=randomUUID();
    const result=await persistConsultationMaterial(next,composeGroundedConsultation(next),op,{token:admin,store});assert.equal(result.state,'persisted');
    const snapshot=async()=>JSON.parse(await sql(`${actor()}select consultation_material_admin_snapshot('${next.id}')`));
    const row=(await snapshot())[0];assert.equal(row.available,true);assert.equal(row.metadata.sources.length,17);
    assert.ok(!JSON.stringify(row).includes(next.fullName));assert.ok(!JSON.stringify(row).includes('parent_fingerprint'));
    for(const call of [`consultation_material_admin_snapshot('${next.id}')`,`consultation_material_admin_review('${next.id}','${row.id}','${row.updated_at}','revoked')`,`consultation_material_admin_purge('${next.id}')`]) {
      await assert.rejects(sql(`${actor(customer)}select ${call}`),/ADMIN_REQUIRED/);
      for(const role of ['anon','service_role'])await assert.rejects(sql(`set role ${role};select ${call}`),/permission denied/);
    }
    const compare=(state:string)=>sql(`${actor()}select consultation_material_admin_review('${next.id}','${row.id}','${row.updated_at}','${state}')`);
    const results=await Promise.all([compare('reviewed'),compare('rejected')]);assert.deepEqual(results.sort(),['f','t']);
    assert.equal((await snapshot())[0].events.length,2);
    assert.equal(await sql(`${actor()}select consultation_material_admin_review('${value.id}','${row.id}','${row.updated_at}','revoked')`),'f');
    const current=(await snapshot())[0];
    assert.equal(await sql(`${actor()}select consultation_material_admin_review('${next.id}','${row.id}','${current.updated_at}','revoked')`),'t');
    const revoked=(await snapshot())[0];assert.equal(revoked.available,false);assert.equal(revoked.metadata,null);assert.equal(revoked.review_state,'revoked');assert.equal(revoked.events.length,3);
    assert.equal(await sql(`${actor()}select consultation_material_admin_purge('${next.id}')`),'1');assert.deepEqual(await snapshot(),[]);
    assert.equal((await store.list(admin,value.id)).length,1,'other parent preserved');
    assert.equal((await persistConsultationMaterial(next,composeGroundedConsultation(next),op,{token:admin,store})).state,'unavailable');
    const newOperation=randomUUID();const expiring=await persistConsultationMaterial(next,composeGroundedConsultation(next),newOperation,{token:admin,store});assert.equal(expiring.state,'persisted');
    await sql(`update consultation_material_requests set expires_at=now()-interval '1 second' where request_id='${next.id}'`);
    assert.equal((await snapshot())[0].metadata,null);assert.equal((await snapshot())[0].available,false);
    assert.equal(await sql(`${actor()}select consultation_material_admin_purge('${next.id}')`),'1');
    await sql(`delete from consultation_requests where id='${next.id}'`);
  });
  await t.test('published general policies and authorized context expiry are also persisted safely', async () => {
    const next=input('Contame sobre Victoriosas, ¿me mandan información por correo?');await admit(next);
    const context={authorized:true,expiresAt:new Date(Date.now()+60000).toISOString()};
    const prepared=composeGroundedConsultation(next,{context});assert.ok(prepared.sources.some(source=>source.id==='initial-step'));
    const result=await persistConsultationMaterial(next,prepared,randomUUID(),{token:admin,store,context});assert.equal(result.state,'persisted');
    const row=(await store.list(admin,next.id))[0] as any;assert.ok(Date.parse(row.expires_at)<=Date.parse(context.expiresAt));
    await sql(`delete from consultation_requests where id='${next.id}'`);
  });
  await t.test('lost acknowledgement after commit is reconciled by the same operation without another row/event', async () => {
    const next=input();await admit(next);const op=randomUUID(),prepared=composeGroundedConsultation(next);
    const uncertain:MaterialStore={...store,save:async(...args)=>{await store.save(...args);throw Error('synthetic acknowledgement loss');}};
    assert.deepEqual(await persistConsultationMaterial(next,prepared,op,{token:admin,store:uncertain}),{state:'unavailable',delivery_decision:'no_send'});
    const reconciled=await persistConsultationMaterial(next,prepared,op,{token:admin,store});assert.equal(reconciled.state,'persisted');
    assert.equal(await sql(`select count(*) from consultation_material_requests where request_id='${next.id}'`),'1');
    assert.equal(await sql(`select count(*) from consultation_material_events where material_id='${(reconciled as any).id}'`),'1');
    await sql(`delete from consultation_requests where id='${next.id}'`);
  });
  await t.test('RLS hides data and audit from customer, anon and service; direct mutations denied', async () => {
    assert.deepEqual(await store.list(customer,value.id),[]);
    assert.equal(await sql(`${actor(customer)}select count(*) from consultation_material_events`),'0');
    for (const role of ['anon','service_role']) {
      await assert.rejects(sql(`set role ${role};select * from consultation_material_requests`),/permission denied/);
      await assert.rejects(sql(`set role ${role};select consultation_material_context('${value.id}')`),/permission denied/);
      await assert.rejects(sql(`set role ${role};select * from private.consultation_material_keys`),/permission denied/);
    }
    await assert.rejects(sql(`${actor(customer)}select nextval('public.consultation_material_events_id_seq')`),/permission denied/);
    for (const statement of [`update consultation_material_requests set delivery_decision='send'`, 'delete from consultation_material_requests', `insert into consultation_material_events(material_id,event) values('${id}','reviewed')`]) await assert.rejects(sql(actor()+statement),/permission denied/);
    assert.equal((await persistConsultationMaterial(value,draft,randomUUID(),{ token: customer,store })).state,'unavailable');
    const payload=JSON.parse(await sql(`select payload from consultation_material_requests where id='${id}'`));
    await assert.rejects(store.save(customer,value.id,randomUUID(),payload),/ADMIN_REQUIRED/);
    await assert.rejects(store.review(customer,id,'reviewed'),/ADMIN_REQUIRED/);
    await assert.rejects(store.purge(customer),/ADMIN_REQUIRED/);
  });
  await t.test('payload conflicts and source tampering fail atomically', async () => {
    const payload = JSON.parse(await sql(`select payload from consultation_material_requests where id='${id}'`));
    await assert.rejects(store.save(admin,value.id,operation,{ ...payload,channel:'whatsapp' }),/MATERIAL_CONFLICT/);
    for (const patch of [{ sources: [] },{ intent:null },{ parent_fingerprint:'0'.repeat(64) },{ sources:[{...payload.sources[0],version:'wrong'}] },{ sources:[{...payload.sources[0],sha256:'0'.repeat(64)}] },{ delivery_decision:'send' }]) {
      await assert.rejects(store.save(admin,value.id,randomUUID(),{...payload,...patch} as MaterialPayload),/MATERIAL_INVALID/);
    }
    assert.equal(await sql(`select count(*) from consultation_material_requests where request_id='${value.id}'`),'1');
  });
  await t.test('administrative review never authorizes delivery, repeated actions do not duplicate audit', async () => {
    assert.equal(await store.review(admin,id,'reviewed'),true);assert.equal(await store.review(admin,id,'reviewed'),true);
    assert.equal(await sql(`select count(*) from consultation_material_events where material_id='${id}' and event='reviewed'`),'1');
    assert.equal(await sql(`select delivery_decision from consultation_material_requests where id='${id}'`),'no_send');
  });
  await t.test('missing or revoked parent consent and changed parent input fail closed', async () => {
    await sql(`update consultation_requests set input=jsonb_set(input,'{consent}','false') where id='${value.id}'`);
    assert.deepEqual(await store.list(admin,value.id),[]);
    assert.equal((await persistConsultationMaterial(value,draft,operation,{token:admin,store})).state,'unavailable');
    assert.equal(await store.review(admin,id,'reviewed'),false,'revoked consent denies repeated review too');
    await sql(`update consultation_requests set input=input-'consent' where id='${value.id}'`);
    assert.equal((await persistConsultationMaterial(value,draft,operation,{token:admin,store})).state,'unavailable');
    await sql(`update consultation_requests set input=jsonb_set(input,'{consent}','true') where id='${value.id}'`);
    await sql(`update consultation_requests set input=jsonb_set(input,'{message}','"Changed synthetic message"') where id='${value.id}'`);
    assert.equal((await persistConsultationMaterial(value,draft,randomUUID(),{token:admin,store})).state,'unavailable');
    assert.deepEqual(await store.list(admin,value.id),[]);
    await sql(`update consultation_requests set input=${literal(value)} where id='${value.id}'`);
  });
  await t.test('revocation clears payload immediately and tombstone prevents resurrection after purge', async () => {
    assert.equal(await store.review(admin,id,'revoked'),true);
    assert.equal(await sql(`select payload from consultation_material_requests where id='${id}'`),'{}');
    assert.equal(await sql(`${actor()}select count(*) from consultation_material_events where material_id='${id}'`),'3');
    assert.deepEqual(await store.list(admin,value.id),[]);
    assert.equal((await persistConsultationMaterial(value,draft,operation,{token:admin,store})).state,'unavailable');
    assert.equal(await store.purge(admin),1);
    assert.equal(await sql(`select count(*) from consultation_material_events where material_id='${id}'`),'0');
    assert.equal((await persistConsultationMaterial(value,draft,operation,{token:admin,store})).state,'unavailable');
    assert.equal(await sql(`select count(*) from private.consultation_material_keys where request_id='${value.id}'`),'1');
  });
  await t.test('expired rows are hidden, erased, and cannot be recreated; parent purge cascades keys', async () => {
    const next = input();await admit(next);const op=randomUUID(), prepared=composeGroundedConsultation(next);
    const result = await persistConsultationMaterial(next,prepared,op,{token:admin,store});assert.equal(result.state,'persisted');
    await sql(`update consultation_material_requests set expires_at=now()-interval '1 second' where request_id='${next.id}'`);
    assert.deepEqual(await store.list(admin,next.id),[]);assert.equal(await store.purge(admin),1);
    assert.equal((await persistConsultationMaterial(next,prepared,op,{token:admin,store})).state,'unavailable');
    await sql(`delete from consultation_requests where id='${next.id}'`);
    assert.equal(await sql(`select count(*) from private.consultation_material_keys where request_id='${next.id}'`),'0');
  });
  await t.test('professional facts withdrawn, changed or expired after composition cannot persist', async () => {
    const next = input('¿En qué consiste la limpieza profunda? ¿Me mandan información por correo?');await admit(next);
    const entry = {slug:'limpieza-profunda',version:0,description:'Descripción sintética.',techniques:'',duration:'',conditions:'',faq:'',internalFee:'',approvedForAI:true,priceApproved:false,validUntil:null};
    assert.equal(await sql(`${actor()}select consultation_knowledge_save(${literal(entry)})`),'t');
    const facts = JSON.parse(await sql('set role service_role;select consultation_knowledge_facts()'));
    const prepared = composeGroundedConsultation(next,{facts});
    assert.ok(prepared.sources.some(source=>source.id==='service:limpieza-profunda'));
    await sql(`${actor()}select consultation_knowledge_save(${literal({...entry,version:1,approvedForAI:false})})`);
    const result=await persistConsultationMaterial(next,prepared,randomUUID(),{token:admin,store,facts});
    assert.equal(result.state,'unavailable','database revalidates even when caller retained old facts');
    for(const patch of [{approvedForAI:true,description:'Changed synthetic.'},{approvedForAI:true,description:'Descripción sintética.',validUntil:'2020-01-01'}]) {
      await sql(`update private.consultation_service_knowledge set entry=entry||${literal(patch)} where slug='limpieza-profunda' and version=1;delete from private.consultation_service_knowledge where slug='limpieza-profunda' and version>1`);
      assert.equal((await persistConsultationMaterial(next,prepared,randomUUID(),{token:admin,store,facts})).state,'unavailable');
    }
  });
  await t.test('database errors and malicious drafts never change no_send', async () => {
    const broken: MaterialStore={...store,context:async()=>{throw Error('private database detail');}};
    const result=await persistConsultationMaterial(value,draft,randomUUID(),{token:admin,store:broken});
    assert.deepEqual(result,{state:'unavailable',delivery_decision:'no_send'});
  });
  await t.test('rollback removes only C objects, preserves parent, and reinstallation works', async () => {
    const before = await sql('select count(*) from consultation_requests');await sql(readFileSync('supabase/staged/rollback/consultation_material_admin_v1.sql','utf8'));await sql(rollback);
    assert.equal(await sql("select to_regclass('public.consultation_material_requests') is null"),'t');
    assert.equal(await sql('select count(*) from consultation_requests'),before);
    await sql(migration);assert.equal(await sql('select count(*) from consultation_material_requests'),'0');await sql(rollback);
  });
});
