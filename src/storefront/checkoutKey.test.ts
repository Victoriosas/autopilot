import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutKey } from './checkoutKey';

test('browser retry and remount keep an opaque key for the same intent; changed intent gets a new key', async () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const intent = { items: [{ productId: 'one', quantity: 1 }], customer: { email: 'buyer@example.test' } };
  const [first, concurrent] = await Promise.all([checkoutKey(storage, intent), checkoutKey(storage, intent)]);
  assert.equal(first, concurrent); assert.equal(await checkoutKey(storage, intent), first);
  assert.notEqual(await checkoutKey(storage, { ...intent, items: [{ productId: 'one', quantity: 2 }] }), first);
  assert.ok(![...values.values()].join('').includes('buyer@example.test'));
});
