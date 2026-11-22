import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { createSixAgentStatusRouter } from './sixAgentStatusRouter';

test('agent status enforces admin auth, masks evidence and distinguishes stale claims', async t => {
  const names = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_ANON_KEY','VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY'] as const;
  const previous = names.map(name => process.env[name]);
  t.after(() => names.forEach((name,index) => {
    if (previous[index] === undefined) delete process.env[name];
    else process.env[name] = previous[index];
  }));
  process.env.SUPABASE_URL = 'https://synthetic.supabase.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-key';
  process.env.SUPABASE_ANON_KEY = 'synthetic-public-key';
  const realFetch = globalThis.fetch;
  let role = 'admin', schemaError = false, reads = 0;
  t.mock.method(globalThis,'fetch', async (input: Parameters<typeof fetch>[0], options?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === '127.0.0.1') return realFetch(input,options);
    assert.equal(url.origin,'https://synthetic.supabase.invalid');
    const headers = new Headers(options?.headers);
    if (url.pathname === '/auth/v1/user') {
      assert.equal(headers.get('authorization'),'Bearer synthetic-admin');
      return Response.json({id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',app_metadata:{},user_metadata:{}});
    }
    if (url.pathname === '/rest/v1/profiles') return Response.json({role});
    assert.equal(url.pathname,'/rest/v1/agent_tasks');
    assert.equal(options?.method ?? 'GET','GET');
    assert.equal(url.searchParams.get('limit'),'500');
    reads++;
    if (schemaError) return Response.json({message:'private-provider-error'}, {status:400});
    return Response.json([{id:'synthetic-task',agent_id:'director',status:'running',attempt_count:1,
      updated_at:'2026-01-01T00:00:00Z',lease_until:'2026-01-01T00:01:00Z',completed_evidence:'private-sentinel'}]);
  });
  const app = express();
  app.use('/api/autopilot/v4/agents-status',createSixAgentStatusRouter());
  const server = app.listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(async () => {server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));});
  const {port} = server.address() as {port:number};
  const request = (auth = true) => fetch(`http://127.0.0.1:${port}/api/autopilot/v4/agents-status`,{
    headers:auth ? {authorization:'Bearer synthetic-admin'} : {},signal:AbortSignal.timeout(5000),
  });
  assert.equal((await request(false)).status,401);
  role = 'member';
  assert.equal((await request()).status,403);
  assert.equal(reads,0);
  role = 'admin';
  const response = await request();
  assert.equal(response.status,200);
  assert.equal(response.headers.get('cache-control'),'no-store');
  const body = await response.json();
  assert.equal(body.agents.length,6);
  assert.equal(body.agents[0].running,0);
  assert.equal(body.agents[0].staleClaims,1);
  assert.equal(body.executorAvailabilityVerified,false);
  assert.ok(!JSON.stringify(body).includes('private-sentinel'));
  schemaError = true;
  const unavailable = await request();
  assert.equal(unavailable.status,503);
  assert.deepEqual(await unavailable.json(),{error:'AGENT_SCHEMA_NOT_READY'});
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const unconfigured = await request();
  assert.equal(unconfigured.status,503);
  assert.deepEqual(await unconfigured.json(),{error:'AGENT_STATUS_NOT_CONFIGURED'});
});
