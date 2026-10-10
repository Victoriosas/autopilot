import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutKey, forgetCheckoutKey, retireReleasedCheckoutKey } from './checkoutKey';

test('browser retry and remount keep an opaque key for the same intent; changed intent gets a new key', async () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const intent = { items: [{ productId: 'one', quantity: 1 }], customer: { email: 'buyer@example.test' } };
  const [first, concurrent] = await Promise.all([checkoutKey(storage, intent), checkoutKey(storage, intent)]);
  assert.equal(first, concurrent); assert.equal(await checkoutKey(storage, intent), first);
  assert.notEqual(await checkoutKey(storage, { ...intent, items: [{ productId: 'one', quantity: 2 }] }), first);
  assert.ok(![...values.values()].join('').includes('buyer@example.test'));
});

test('terminal checkout retires only its own key and allows the same intent to be purchased again', async () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const first = await checkoutKey(storage, { items: ['one'] });
  forgetCheckoutKey(storage, first);
  const second = await checkoutKey(storage, { items: ['one'] });
  assert.notEqual(first, second);
  forgetCheckoutKey(storage, first);
  assert.equal(await checkoutKey(storage, { items: ['one'] }), second);
});

test('abandoned released attempt rotates only after explicit server conflict; unknown outcomes keep key', async () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const intent = { items: ['one'] };
  const first = await checkoutKey(storage, intent);
  for (const [status, result] of [
    [503, { error: 'CHECKOUT_RESERVATION_RELEASED', retryAllowed: true }],
    [409, { error: 'RESERVATION_EXPIRED', retryAllowed: true }],
    [409, { error: 'CHECKOUT_RESERVATION_RELEASED' }],
    [409, { error: 'CHECKOUT_RESERVATION_RELEASED', retryAllowed: 'true' }],
  ] as const) {
    assert.equal(retireReleasedCheckoutKey(storage, first, status, result), false);
    assert.equal(await checkoutKey(storage, intent), first);
  }
  assert.equal(retireReleasedCheckoutKey(storage, first, 409, { error: 'CHECKOUT_RESERVATION_RELEASED', retryAllowed: true }), true);
  const second = await checkoutKey(storage, intent);
  assert.notEqual(second, first);
  assert.equal(await checkoutKey(storage, intent), second);
});
