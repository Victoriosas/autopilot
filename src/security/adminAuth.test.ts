import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createLegacyAdminGuard } from './adminAuth';

test('legacy admin guard protects case aliases and only exempts the V4 path segment', async () => {
  const app = express();
  app.use(createLegacyAdminGuard());
  app.use((_req, res) => res.status(200).json({ reached: true }));
  const server = createServer(app).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as { port: number };
  try {
    for (const path of ['/api/sourcing/products', '/api/autopilot/discover', '/api/fulfillment/status', '/api/connectors', '/api/autopilot/v4evil']) {
      for (const alias of [path, `${path}/`, path.toUpperCase()]) {
        const response = await fetch(`http://127.0.0.1:${port}${alias}?ignored=1`);
        assert.equal(response.status, 401, alias);
        assert.equal((await response.json()).error, 'ADMIN_AUTH_REQUIRED');
      }
    }
    for (const path of ['/api/autopilot/v4', '/API/AUTOPILOT/V4/', '/api/autopilot/v4/sourcing', '/api/health']) {
      assert.equal((await fetch(`http://127.0.0.1:${port}${path}`)).status, 200, path);
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('admin verification keeps caller-scoped profiles and distinguishes provider outages', async (t) => {
  const names = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY'] as const;
  const previous = names.map(name => process.env[name]);
  t.after(() => names.forEach((name, index) => {
    const value = previous[index];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }));
  const provider = 'http://127.0.0.1:59999';
  const userId = '11111111-1111-4111-8111-111111111111';
  const request = globalThis.fetch;
  process.env.SUPABASE_URL = provider;
  delete process.env.VITE_SUPABASE_ANON_KEY;

  let authStatus = 200;
  let profileStatus = 200;
  let role = 'admin';
  const mockFetch: typeof fetch = async (input, options) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.origin, provider);
    const headers = new Headers(options?.headers);
    assert.equal(headers.get('authorization'), 'Bearer fixture-token');
    assert.equal(headers.get('apikey'), 'synthetic-key');
    if (url.pathname === '/auth/v1/user') {
      return Response.json(authStatus === 200
        ? { id: userId, aud: 'authenticated', app_metadata: {}, user_metadata: {} }
        : { message: 'Synthetic provider error' }, { status: authStatus });
    }
    assert.equal(url.pathname, '/rest/v1/profiles');
    assert.equal(url.searchParams.get('id'), `eq.${userId}`);
    return Response.json(profileStatus === 200 ? { role } : { message: 'Synthetic provider error' }, {
      status: profileStatus,
    });
  };
  t.mock.method(globalThis, 'fetch', mockFetch);

  const app = express();
  app.use(createLegacyAdminGuard());
  app.get('/api/connectors', (_req, res) => res.json({ admin: res.locals.adminUserId }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });
  const { port } = server.address() as { port: number };
  const probe = async () => {
    const response = await request(`http://127.0.0.1:${port}/api/connectors`, {
      headers: { Authorization: 'Bearer fixture-token' },
    });
    return { status: response.status, body: await response.json() };
  };

  for (const key of ['SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'] as const) {
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env[key] = 'synthetic-key';
    role = 'admin';
    assert.deepEqual(await probe(), { status: 200, body: { admin: userId } }, key);
    role = 'member';
    assert.deepEqual(await probe(), { status: 403, body: { error: 'ADMIN_ROLE_REQUIRED' } }, key);
  }
  authStatus = 401;
  assert.deepEqual(await probe(), { status: 401, body: { error: 'ADMIN_AUTH_INVALID' } });
  authStatus = 200;
  profileStatus = 503;
  assert.deepEqual(await probe(), { status: 503, body: { error: 'ADMIN_AUTH_UNAVAILABLE' } });
  profileStatus = 200;
  authStatus = 503;
  assert.deepEqual(await probe(), { status: 503, body: { error: 'ADMIN_AUTH_UNAVAILABLE' } });
});
