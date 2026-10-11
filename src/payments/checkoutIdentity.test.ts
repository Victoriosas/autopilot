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
