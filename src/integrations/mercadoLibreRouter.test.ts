import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createMercadoLibreRouter } from './mercadoLibreRouter';

test('Mercado Libre rejects unauthorized admin routes and invalid OAuth callbacks', async () => {
  const app = express();
  app.use('/api/integrations/mercadolibre', createMercadoLibreRouter());
  const server = createServer(app).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as { port: number };
  const base = `http://127.0.0.1:${port}/api/integrations/mercadolibre`;
  try {
    for (const route of ['status', 'authorize']) {
      const response = await fetch(`${base}/${route}`);
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: 'ADMIN_AUTH_REQUIRED' });
    }
    for (const [query, cookie] of [
      ['', ''],
      ['?code=test&state=expected', ''],
      ['?code=test&state=expected', 'victoriosa_ml_oauth_state=other'],
      ['?code=test&state=expected', 'victoriosa_ml_oauth_state=%E0%A4%A'],
    ]) {
      const response = await fetch(`${base}/callback${query}`, {
        headers: { cookie }, signal: AbortSignal.timeout(1500), redirect: 'manual',
      });
      assert.equal(response.status, 400);
      assert.equal(await response.text(), 'Mercado Libre OAuth: state o code inválido.');
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('admin OAuth uses a secure state cookie and persists only encrypted provider tokens', async (t) => {
  const values = {
    SUPABASE_URL: 'https://oauth.example.test', SUPABASE_SERVICE_ROLE_KEY: 'test-only-key',
    MERCADOLIBRE_CLIENT_ID: 'test-client', MERCADOLIBRE_CLIENT_SECRET: 'test-secret',
    MERCADOLIBRE_TOKEN_ENCRYPTION_KEY: '01'.repeat(32),
    MERCADOLIBRE_REDIRECT_URI: 'https://store.example.test/api/integrations/mercadolibre/callback',
    MERCADOLIBRE_ACCESS_TOKEN: '', ML_ACCESS_TOKEN: '', NODE_ENV: 'production',
  };
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  const nativeFetch = globalThis.fetch;
  let persisted: Record<string, unknown> | undefined;
  t.mock.method(globalThis, 'fetch', async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === '127.0.0.1') return nativeFetch(input, init);
    if (url.hostname === 'api.mercadolibre.com') {
      assert.equal(url.pathname, '/oauth/token');
      assert.equal(new URLSearchParams(String(init?.body)).get('code'), 'test-code');
      return Response.json({ access_token: 'test-access-token', refresh_token: 'test-refresh-token', expires_in: 3600 });
    }
    assert.equal(url.hostname, 'oauth.example.test', 'real services must not be called');
    if (url.pathname === '/auth/v1/user') return Response.json({ id: 'test-admin' });
    if (url.pathname === '/rest/v1/profiles') return Response.json({ role: 'admin' });
    assert.equal(url.pathname, '/rest/v1/provider_oauth_tokens');
    if (init?.method === 'POST') {
      persisted = JSON.parse(String(init.body));
      return new Response(null, { status: 201 });
    }
    return Response.json(null);
  });
  const app = express();
  app.use('/api/integrations/mercadolibre', createMercadoLibreRouter());
  const server = createServer(app).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as { port: number };
  const base = `http://127.0.0.1:${port}/api/integrations/mercadolibre`;
  const headers = { authorization: 'Bearer test-admin-token' };
  try {
    const status = await fetch(`${base}/status`, { headers });
    assert.equal(status.status, 200);
    assert.equal((await status.json()).connected, false);
    const authorization = await fetch(`${base}/authorize`, { headers });
    assert.equal(authorization.status, 200);
    const cookie = authorization.headers.get('set-cookie') || '';
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=Lax/);
    const state = new URL((await authorization.json()).authorizationUrl).searchParams.get('state');
    assert.match(state || '', /^[a-f0-9]{48}$/);
    assert.ok(cookie.startsWith(`victoriosa_ml_oauth_state=${state};`));
    const callback = await fetch(`${base}/callback?code=test-code&state=${state}`, {
      headers: { cookie: cookie.split(';')[0] }, redirect: 'manual',
    });
    assert.equal(callback.status, 302);
    assert.equal(callback.headers.get('location'), '/?mercadolibre=connected');
    assert.match(callback.headers.get('set-cookie') || '', /Expires=Thu, 01 Jan 1970/);
    assert.match(String(persisted?.access_token_ciphertext), /^v1:/);
    assert.match(String(persisted?.refresh_token_ciphertext), /^v1:/);
    assert.ok(!JSON.stringify(persisted).includes('test-access-token'));
    assert.ok(!JSON.stringify(persisted).includes('test-refresh-token'));
    delete process.env.MERCADOLIBRE_CLIENT_SECRET;
    const unavailable = await fetch(`${base}/authorize`, { headers });
    assert.equal(unavailable.status, 503);
    assert.deepEqual(await unavailable.json(), { error: 'MERCADOLIBRE_OAUTH_NOT_CONFIGURED' });
    const failed = await fetch(`${base}/callback?code=test-code&state=expected`, {
      headers: { cookie: 'victoriosa_ml_oauth_state=expected' },
    });
    assert.equal(failed.status, 502);
    assert.equal(await failed.text(), 'Mercado Libre OAuth: no se pudo completar la conexión.');
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
