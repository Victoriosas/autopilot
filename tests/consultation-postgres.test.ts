import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const database = process.env.BEAUTY_TEST_DATABASE_URL;
if (!database) throw Error('Run node scripts/test-consultation-postgres.mjs');
const target = new URL(database);
assert.equal(target.hostname, '127.0.0.1');
assert.equal(target.pathname, '/victoriosa_beauty_test');
function sql(query: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(process.env.PSQL_PATH || 'psql', [database!, '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], { windowsHide: true }, (error, out, err) => error ? reject(Error(err)) : resolve(out.trim()));
    child.stdin!.end(query);
  });
}
const literal = (value: unknown) => "'" + JSON.stringify(value).replace(/'/g, "''") + "'::jsonb";
const fixture = (id = randomUUID()) => ({ id, fullName: 'Consulta sintética', phone: '+598 099123456', email: '', age: null, service: 'orientacion', message: 'Información general.', responseChannel: 'whatsapp', consent: true, consentVersion: 'consultation-v1', website: '' });
const hash = 'a'.repeat(64), abuse = 'b'.repeat(64);
const claim = (input: ReturnType<typeof fixture>, fingerprint = hash, address = abuse) => sql(`set role service_role;select public.consultation_claim(${literal(input)},'${fingerprint}','${address}');`).then(JSON.parse);

test('private consultation outbox on disposable PostgreSQL', { timeout: 120000 }, async t => {
  await sql(`do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls;end if;end$$;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create table public.profiles(id uuid primary key,role text);grant select on public.profiles to authenticated;insert into profiles values('11111111-1111-4111-8111-111111111111','admin'),('22222222-2222-4222-8222-222222222222','customer');`);
  const migration = readFileSync('supabase/migrations/20261023042129_consultation_private_outbox.sql', 'utf8');
  await sql(migration);
  const readingMigration = readdirSync('supabase/migrations').find(name => name.endsWith('_consultation_read_states.sql'));
  if (readingMigration) await sql(readFileSync('supabase/migrations/' + readingMigration, 'utf8'));
  await t.test('schema ready only through service role; migration can be reapplied', async () => {
    assert.equal(await sql('set role service_role;select public.consultation_schema_ready()'), 'consultation-v1');
    await sql(migration);
    for (const role of ['anon', 'authenticated']) await assert.rejects(sql(`set role ${role};select public.consultation_schema_ready()`), /permission denied/);
  });
  const input = fixture();
  let lease = '';
  await t.test('concurrent claims produce one send lease and preserve payload', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => claim(input)));
    assert.equal(results.filter(result => result.state === 'send').length, 1);
    assert.equal(results.filter(result => result.state === 'pending').length, 7);
    lease = results.find(result => result.state === 'send').lease;
    assert.deepEqual(JSON.parse(await sql(`select input from public.consultation_requests where id='${input.id}'`)), input);
  });
  await t.test('different content conflicts and stale leases cannot acknowledge delivery', async () => {
    assert.equal((await claim(input, 'c'.repeat(64))).state, 'conflict');
    assert.equal(await sql(`set role service_role;select consultation_finish('${input.id}','${randomUUID()}','fixture-provider')`), 'f');
    await sql(`update private.consultation_outbox set lease_until=now()-interval '1 minute' where request_id='${input.id}'`);
    const retry = await claim(input);
    assert.equal(retry.state, 'send'); assert.notEqual(retry.lease, lease);
    assert.equal(await sql(`set role service_role;select consultation_finish('${input.id}','${lease}','fixture-provider')`), 'f');
    lease = retry.lease;
    assert.equal(await sql(`set role service_role;select consultation_finish('${input.id}','${lease}','fixture-provider')`), 't');
    assert.equal((await claim(input)).state, 'accepted');
  });
  await t.test('durable hourly limit allows five distinct requests and rejects the sixth', async () => {
    for (let index = 0; index < 4; index++) assert.equal((await claim(fixture())).state, 'send');
    assert.equal((await claim(fixture())).state, 'throttled');
    assert.equal(await sql('select count(*) from public.consultation_requests'), '5');
  });
  await t.test('provider deduplication safety window prevents uncertain sends after 23 hours', async () => {
    const old = fixture(); const first = await claim(old, hash, 'd'.repeat(64)); assert.equal(first.state, 'send');
    await sql(`update private.consultation_outbox set first_attempt_at=now()-interval '23 hours',lease_until=now()-interval '1 minute' where request_id='${old.id}'`);
    assert.equal((await claim(old, hash, 'd'.repeat(64))).state, 'expired');
  });
  await t.test('anonymous/customer/service roles cannot read private data; admin sees unexpired only', async () => {
    for (const role of ['anon', 'service_role']) await assert.rejects(sql(`set role ${role};select input from public.consultation_requests`), /permission denied/);
    assert.equal(await sql("set role authenticated;set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';select count(*) from public.consultation_requests"), '0');
    assert.equal(await sql("set role authenticated;set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';select count(*) from public.consultation_requests"), '6');
    await assert.rejects(sql('set role authenticated;select * from private.consultation_outbox'), /permission denied/);
    await assert.rejects(sql('set role service_role;select * from private.consultation_outbox'), /permission denied/);
    await assert.rejects(sql('set role authenticated;delete from public.consultation_requests'), /permission denied/);
  });
  await t.test('retention erases expired contact details and their notification state', async () => {
    await sql(`update public.consultation_requests set expires_at=now()-interval '1 minute' where id='${input.id}'`);
    assert.equal((await claim(input)).state, 'expired');
    assert.equal(await sql('set role service_role;select public.consultation_purge_expired()'), '1');
    assert.equal(await sql(`select count(*) from private.consultation_outbox where request_id='${input.id}'`), '0');
    await assert.rejects(sql('set role anon;select public.consultation_purge_expired()'), /permission denied/);
  });
  await t.test('shared read state is private, reversible, expiry-scoped and cascades with consultations', async () => {
    assert.equal(await sql("select to_regclass('public.consultation_read_states')::text"), 'consultation_read_states');
    await sql(readFileSync('supabase/migrations/' + readingMigration!, 'utf8'));
    const current = fixture(), expired = fixture(), admin = '11111111-1111-4111-8111-111111111111';
    const baseline = Number(await sql('set role service_role;select unread_requests from public.consultation_read_metrics'));
    await sql(`insert into public.consultation_requests(id,fingerprint,input,expires_at) values('${current.id}','${hash}',${literal(current)},now()+interval '1 day'),('${expired.id}','${hash}',${literal(expired)},now()-interval '1 day')`);
    assert.equal(await sql('set role service_role;select unread_requests from public.consultation_read_metrics'), String(baseline + 1));
    await sql(`set role service_role;insert into public.consultation_read_states(request_id,read_by) values('${current.id}','${admin}')`);
    assert.equal(await sql('set role service_role;select unread_requests from public.consultation_read_metrics'), String(baseline));
    assert.equal(await sql(`select count(*) from private.consultation_outbox where request_id='${current.id}'`), '0', 'read never creates a delivery');
    for (const role of ['anon', 'authenticated']) {
      await assert.rejects(sql(`set role ${role};select * from public.consultation_read_states`), /permission denied/);
      await assert.rejects(sql(`set role ${role};select * from public.consultation_read_metrics`), /permission denied/);
      await assert.rejects(sql(`set role ${role};insert into public.consultation_read_states(request_id,read_by) values('${expired.id}','${admin}')`), /permission denied/);
    }
    await assert.rejects(sql('set role service_role;select input from public.consultation_requests'), /permission denied/);
    assert.equal(await sql("select relrowsecurity from pg_class where oid='public.consultation_read_states'::regclass"), 't');
    assert.match(await sql("select reloptions::text from pg_class where oid='public.consultation_read_metrics'::regclass"), /security_invoker=true/);
    await sql(`set role service_role;delete from public.consultation_read_states where request_id='${current.id}'`);
    assert.equal(await sql('set role service_role;select unread_requests from public.consultation_read_metrics'), String(baseline + 1));
    await sql(`set role service_role;insert into public.consultation_read_states(request_id,read_by) values('${current.id}','${admin}')`);
    await sql(`delete from public.consultation_requests where id='${current.id}'`);
    assert.equal(await sql(`select count(*) from public.consultation_read_states where request_id='${current.id}'`), '0');
  });
  await t.test('intelligence leases, budgets, approval CAS and retention on real PostgreSQL',async()=>{
    const file=readdirSync('supabase/migrations').find(name=>name.endsWith('_consultation_intelligence_shadow.sql'))!;
    await sql(readFileSync('supabase/migrations/20261023224500_consultation_reply_outbox.sql','utf8'));
    await sql(readFileSync('supabase/migrations/'+file,'utf8'));
    const current=fixture();await claim(current,hash,'f'.repeat(64));
    const acquire=()=>sql(`set role service_role;select consultation_ai_claim('${current.id}','${hash}','fixture-v1')`).then(JSON.parse);
    const results=await Promise.all(Array.from({length:6},acquire));
    assert.equal(results.filter(r=>r.state==='claimed').length,1);
    assert.equal(results.filter(r=>r.state==='busy').length,5);
    const claimed=results.find(r=>r.state==='claimed');
    const reserve=()=>sql(`set role service_role;select consultation_ai_reserve_budget('${claimed.id}',50000,50000,50000)`);
    assert.deepEqual(await Promise.all([reserve(),reserve()]),['t','f']);
    const analysis={version:'consultation-intelligence-v1',mode:'shadow',conversationVersion:hash,expiresAt:new Date(Date.now()+600000).toISOString(),guardian:{status:'approved',codes:[]},drafts:[{text:'Respuesta sintética. Victoria | Victoriosas'}],fingerprint:hash,statistics:{calls:0}};
    const finish=(lease:string)=>sql(`set role service_role;select consultation_ai_finish('${claimed.id}','${lease}',${literal(analysis)})`);
    assert.equal(await finish(randomUUID()),'f');assert.equal(await finish(claimed.lease),'t');assert.equal(await finish(claimed.lease),'f');
    assert.equal((await acquire()).state,'ready');
    const approve=(text:string)=>sql(`set role service_role;select consultation_ai_review('${current.id}','${claimed.id}','11111111-1111-4111-8111-111111111111','${text}','${hash}','approve')`);
    assert.equal(await approve('Texto cambiado'),'f');assert.equal(await approve(analysis.drafts[0].text),'t');
    assert.equal(await sql(`select count(*) from consultation_intelligence_events where run_id='${claimed.id}' and kind='approve'`),'1');
    const event=(kind:string,key:string,payload:unknown)=>sql(`set role service_role;select consultation_ai_record_event('${current.id}','${claimed.id}','11111111-1111-4111-8111-111111111111','${kind}','${key}',${literal(payload)})`);
    const occurredAt=new Date(Date.now()-3*86400000).toISOString(),source='1'.repeat(64);
    assert.equal(await event('proposal_confirmed',source,{occurredAt}),'t');
    assert.equal(await event('followup_proposed','2'.repeat(64),{occurredAt,sourceKey:source}),'f','general form consent is not followup consent');
    assert.equal(await event('consent_recorded','3'.repeat(64),{occurredAt,consentReference:randomUUID()}),'t');
    assert.equal(await event('followup_proposed','2'.repeat(64),{occurredAt,sourceKey:source}),'t');
    assert.equal(await event('followup_proposed','4'.repeat(64),{occurredAt,sourceKey:source}),'f','a different event key cannot duplicate a source followup');
    const report=JSON.parse(await sql('set role service_role;select consultation_ai_report()'));
    assert.equal(report.runs,1);assert.equal(report.actualCost,null);assert.equal(report.delivered,null);
    for(const role of ['anon','authenticated']){
      await assert.rejects(sql(`set role ${role};select * from consultation_intelligence_runs`),/permission denied/);
      await assert.rejects(sql(`set role ${role};select consultation_ai_claim('${current.id}','${hash}','fixture-v1')`),/permission denied/);
    }
    await assert.rejects(sql('set role service_role;select input from consultation_requests'),/permission denied/);
    await sql(`update consultation_requests set expires_at=now()-interval '1 minute' where id='${current.id}'`);
    assert.equal(await approve(analysis.drafts[0].text),'f');
    await sql('set role service_role;select consultation_purge_expired()');
    assert.equal(await sql(`select count(*) from consultation_intelligence_runs where request_id='${current.id}'`),'0');
    assert.equal(await sql(`select count(*) from consultation_intelligence_events where run_id='${claimed.id}'`),'0');
  });
});
