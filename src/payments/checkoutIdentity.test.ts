import test from 'node:test';
import assert from 'node:assert/strict';

const subject = () => import('./checkoutIdentity');
const userId = '11111111-1111-4111-8111-111111111111';
test('guest checkout requires no Auth request', async () => {
  const { resolveCheckoutUser } = await subject();
  let calls = 0;
  assert.equal(await resolveCheckoutUser(undefined, async () => { calls++; return userId; }), null);
  assert.equal(calls, 0);
});
test('checkout ownership comes only from server-verified bearer identity', async () => {
  const { resolveCheckoutUser } = await subject();
  let token = '';
  assert.equal(await resolveCheckoutUser('Bearer fixture-token', async value => {
    token = value; return userId;
  }), userId);
  assert.equal(token, 'fixture-token');
});
test('malformed supplied authorization never silently becomes guest checkout', async () => {
  const { resolveCheckoutUser } = await subject();
  for (const value of ['', 'Basic abc', 'Bearer ', 'Bearer a b', 'Bearer ' + 'x'.repeat(5000)]) {
    let calls = 0;
    await assert.rejects(resolveCheckoutUser(value, async () => { calls++; return userId; }),
      (error: any) => error.status === 401 && error.message === 'CHECKOUT_AUTHENTICATION_REQUIRED');
    assert.equal(calls, 0);
  }
});
test('invalid identity cannot reserve on behalf of a supplied user', async () => {
  const { resolveCheckoutUser } = await subject();
  for (const value of [null, '', 'not-a-uuid']) {
    await assert.rejects(resolveCheckoutUser('Bearer fixture-token', async () => value),
      (error: any) => error.status === 401);
  }
});
test('Auth outage and missing server configuration fail closed without leaking errors', async () => {
  const { resolveCheckoutUser } = await subject();
  await assert.rejects(resolveCheckoutUser('Bearer fixture-token', async () => {
    throw new Error('PRIVATE_UPSTREAM_DETAIL');
  }), (error: any) => error.status === 503 && error.message === 'CHECKOUT_AUTH_UNAVAILABLE');
});

test('default Auth adapter verifies the bearer and handles invalid or unavailable responses', async () => {
  const { resolveCheckoutUser } = await subject();
  const names = ['SUPABASE_URL', 'VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
  const old = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const originalFetch = globalThis.fetch;
  process.env.SUPABASE_URL = 'http://127.0.0.1:59999';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-test-key';
  let status = 200;
  globalThis.fetch = async (input, options) => {
    assert.equal(new URL(String(input)).pathname, '/auth/v1/user');
    assert.equal(new Headers(options?.headers).get('authorization'), 'Bearer fixture-token');
    return new Response(JSON.stringify(status === 200 ? {
      id: userId, email: 'fixture@example.test', aud: 'authenticated',
      app_metadata: {}, user_metadata: {}, created_at: '2026-10-11T00:00:00Z',
    } : { message: 'PRIVATE_DETAIL', code: 'bad_jwt' }), {
      status, headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    assert.equal(await resolveCheckoutUser('Bearer fixture-token'), userId);
    status = 401;
    await assert.rejects(resolveCheckoutUser('Bearer fixture-token'), (error: any) => error.status === 401);
    status = 503;
    await assert.rejects(resolveCheckoutUser('Bearer fixture-token'), (error: any) =>
      error.status === 503 && !error.message.includes('PRIVATE_DETAIL'));
    delete process.env.SUPABASE_URL;
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    await assert.rejects(resolveCheckoutUser('Bearer fixture-token'), (error: any) => error.status === 503);
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of names) {
      if (old[name] === undefined) delete process.env[name];
      else process.env[name] = old[name];
    }
  }
});
