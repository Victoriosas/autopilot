import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { createConsultationRouter } from '../src/storefront/consultationRouter';

assert.equal(process.env.BEAUTY_SYNTHETIC_SUPABASE, 'true');
const config = JSON.parse(readFileSync(process.env.SUPABASE_LOCAL_STATUS_FILE!, 'utf8'));
const url = new URL(config.API_URL);
assert.equal(url.origin, 'http://127.0.0.1:54321');
const publicKey = config.ANON_KEY || config.PUBLISHABLE_KEY;
const serviceKey = config.SERVICE_ROLE_KEY || config.SECRET_KEY;
const client = (key: string) => createClient(url.origin, key, { auth: { persistSession: false, autoRefreshToken: false } });
const service = client(serviceKey), anon = client(publicKey);

test('consultation actual disposable Auth PostgREST RPC and administrator RLS', { timeout: 120000 }, async t => {
  Object.assign(process.env, { SUPABASE_URL: url.origin, SUPABASE_SERVICE_ROLE_KEY: serviceKey, SUPABASE_ANON_KEY: publicKey });
  const actors: Record<string, { token: string; db: ReturnType<typeof client>; id: string }> = {};
  const app = express();
  let deliveries = 0;
  app.use('/inquiries', createConsultationRouter({ intelligence:{enabled:()=>true},enabled: () => true, origin: () => 'https://victoriosas.online', abuseKey: () => 'synthetic-only', delivery: { ready: () => true, send: async () => { deliveries++; return 'fixture-provider'; } } }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as any).port}/inquiries`;
  const input = { id: randomUUID(), fullName: 'Consulta sintética', phone: '+598 099123456', email: '', age: null, service: 'orientacion', message: 'Información general.', responseChannel: 'whatsapp', consent: true, consentVersion: 'consultation-v1', website: '' };
  const post = (body = input) => fetch(base, { method: 'POST', headers: { origin: 'https://victoriosas.online', 'content-type': 'application/json' }, body: JSON.stringify(body) });
  try {
    await t.test('actual identities provisioned only in disposable fixture', async () => {
      for (const role of ['admin', 'customer']) {
        const email = 'consultation-' + randomUUID() + '@example.test', password = 'Fixture-' + randomUUID() + '-9a!';
        const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
        assert.equal(created.error, null); const id = created.data.user!.id;
        const profile = await service.from('profiles').upsert({ id, role }); assert.equal(profile.error, null);
        const db = client(publicKey), login = await db.auth.signInWithPassword({ email, password });
        assert.equal(login.error, null); actors[role] = { token: login.data.session!.access_token, db, id };
      }
    });
    await t.test('anonymous private RPC is denied and ready schema enables fixture only', async () => {
      assert.ok((await anon.rpc('consultation_schema_ready')).error);
      assert.equal((await (await fetch(base + '/config')).json()).enabled, true);
      assert.ok((await service.from('consultation_requests').select('input')).error);
    });
    await t.test('real RPC persists once; replay never calls email stub twice', async () => {
      assert.equal((await post()).status, 202); assert.equal((await post()).status, 202); assert.equal(deliveries, 1);
      assert.equal((await post({ ...input, message: 'Otra consulta.' })).status, 409);
      const rows = await actors.admin.db.from('consultation_requests').select('id,input').eq('id', input.id);
      assert.equal(rows.error, null, rows.error?.message); assert.equal(rows.data!.length, 1); assert.deepEqual(rows.data![0].input, input);
      const hidden = await actors.customer.db.from('consultation_requests').select('id,input').eq('id', input.id);
      assert.equal(hidden.error, null); assert.deepEqual(hidden.data, []);
    });
    await t.test('HTTP inbox checks real Auth and profile role then applies caller RLS', async () => {
      assert.equal((await fetch(base + '/admin')).status, 401);
      assert.equal((await fetch(base + '/admin', { headers: { authorization: 'Bearer ' + actors.customer.token } })).status, 403);
      const response = await fetch(base + '/admin', { headers: { authorization: 'Bearer ' + actors.admin.token } });
      assert.equal(response.status, 200); const payload = await response.json();
      assert.equal(payload.requests.some((row: { id: string }) => row.id === input.id), true);
    });
    await t.test('real administrator read markers persist and count unread without creating replies', async () => {
      const adminHeaders = { authorization: 'Bearer ' + actors.admin.token, origin: 'https://victoriosas.online', 'content-type': 'application/json', 'x-consultation-approval': input.id };
      const mark = (read: boolean, headers = adminHeaders) => fetch(base + '/admin/' + input.id + '/read-state', { method: 'POST', headers, body: JSON.stringify({ read }) });
      const metrics = async () => {
        const response = await fetch(base + '/admin/metrics', { headers: adminHeaders });
        assert.equal(response.status, 200); return response.json();
      };
      assert.ok((await anon.from('consultation_read_states').select('*')).error);
      assert.ok((await actors.admin.db.from('consultation_read_states').select('*')).error, 'even admins use the authorized server route');
      assert.ok((await actors.customer.db.from('consultation_read_metrics').select('*')).error);
      assert.equal((await mark(true, { ...adminHeaders, authorization: 'Bearer ' + actors.customer.token })).status, 403);
      assert.equal((await metrics()).unreadRequests, 1);
      const response = await mark(true); assert.equal(response.status, 200);
      assert.equal(typeof (await response.json()).readAt, 'string');
      assert.equal((await metrics()).unreadRequests, 0);
      const listed = await (await fetch(base + '/admin', { headers: adminHeaders })).json();
      assert.equal(typeof listed.readStates[input.id], 'string');
      assert.equal((await mark(true)).status, 200); assert.equal((await metrics()).unreadRequests, 0);
      const audit = await service.from('consultation_read_states').select('read_by').eq('request_id', input.id).single();
      assert.equal(audit.error, null); assert.equal(audit.data!.read_by, actors.admin.id);
      assert.equal((await mark(false)).status, 200); assert.equal((await metrics()).unreadRequests, 1);
      const counts = await metrics(); assert.equal(counts.activeRequests, 1); assert.equal(counts.sentLast30Days, 0);
      assert.equal(deliveries, 1, 'reading must not send or resend the notification');
    });
    await t.test('shadow analysis uses real authenticated persistence without sending',async()=>{
      const headers={authorization:'Bearer '+actors.admin.token,origin:'https://victoriosas.online','content-type':'application/json','x-consultation-approval':input.id};
      const path=base+'/admin/'+input.id+'/intelligence';
      assert.equal((await fetch(path,{method:'POST',headers:{...headers,authorization:'Bearer '+actors.customer.token},body:'{}'})).status,403);
      const response=await fetch(path,{method:'POST',headers,body:'{}'});assert.equal(response.status,200);const result=await response.json();
      assert.equal(result.analysis.mode,'shadow');assert.equal(result.analysis.decision.action,'no_send');
      const stored=await service.from('consultation_intelligence_runs').select('analysis').eq('id',result.id).single();assert.equal(stored.error,null);assert.equal(stored.data!.analysis.fingerprint,result.analysis.fingerprint);
      assert.ok((await actors.admin.db.from('consultation_intelligence_runs').select('*')).error);
      const replay=await (await fetch(path,{method:'POST',headers,body:'{}'})).json();assert.equal(replay.id,result.id);
      assert.equal(deliveries,1);assert.ok((await anon.rpc('consultation_ai_report')).error);
    });
  } finally {
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
    for (const actor of Object.values(actors)) { await actor.db.auth.signOut(); await service.auth.admin.deleteUser(actor.id); }
  }
});
