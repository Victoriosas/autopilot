import test from 'node:test';
import assert from 'node:assert/strict';
import { createAtomicCheckout, runFulfillmentJob } from './atomicCheckout';

test('checkout retries use one stable provider key and server snapshot; unknown outcomes retain reservation', async () => {
  let providerCalls = 0; let reserved = 0;
  let bound: any;
  let begun = false;
  const row = { orderId: 'server-order', total: 100, currency: 'UYU', shipping: 0, items: [{ title: 'Vincha', price: 100, quantity: 1 }], state: 'held', checkoutUrl: null };
  const store = async (command: string, args: any) => {
    if (command === 'reserve') { reserved++; return { ...row, ...bound }; }
    if (command === 'bind') { bound = { checkoutUrl: args.checkoutUrl, providerOrderId: args.providerOrderId }; return { ok: true }; }
    if (command === 'begin_provider') { begun = true; return { ok: true }; }
    throw new Error(`Unexpected command: ${command}`);
  };
  let uncertain = true;
  const gateway = { async create(snapshot: any) {
    providerCalls++; assert.equal(begun, true, 'mark uncertain provider operation before HTTP'); assert.equal(snapshot.orderId, 'server-order'); assert.equal(snapshot.total, 100);
    if (uncertain) throw new Error('SIMULATED_NETWORK_TIMEOUT');
    return { id: 'provider-order', checkoutUrl: 'https://example.test/pay' };
  }, async lookup() { throw new Error('unused'); } };
  const checkout = createAtomicCheckout(store, gateway);
  const request = { key: 'client-checkout-key', total: 1 };
  await assert.rejects(checkout.start(request), /SIMULATED_NETWORK_TIMEOUT/);
  uncertain = false;
  const first = await checkout.start(request);
  const replay = await checkout.start(request);
  assert.equal(first.orderId, replay.orderId); assert.equal(providerCalls, 2); assert.equal(reserved, 3);
});

test('expired checkout cannot offer a payment URL or initiate a gateway operation', async () => {
  let calls = 0;
  const checkout = createAtomicCheckout(async () => ({ state: 'held', expired: true, checkoutUrl: 'https://example.test/pay' }), {
    async create() { calls++; return { id: 'order', checkoutUrl: 'https://example.test/pay' }; }, async lookup() { throw new Error('unused'); },
  });
  await assert.rejects(checkout.start({}), /RESERVATION_EXPIRED/); assert.equal(calls, 0);
});

test('provider truth must match local order, currency, amount and terminal status before confirmation', async () => {
  const calls: Array<{ command: string; args: any }> = [];
  let truth: any = { external_reference: 'local-order', total_amount: '100', total_paid_amount: '100', currency_id: 'UYU', status: 'processed' };
  const checkout = createAtomicCheckout(async (command: string, args: any) => {
    calls.push({ command, args }); return { paymentStatus: 'paid' };
  }, { async create() { throw new Error('unused'); }, async lookup() { return truth; } });
  await checkout.reconcile('provider-order');
  assert.equal(calls[0].command, 'payment'); assert.equal(calls[0].args.amount, 100);
  for (const change of [{ currency_id: '' }, { total_paid_amount: 'Infinity' }, { total_paid_amount: '99.99' }, { external_reference: '' }]) {
    const before = calls.length; const original = truth; truth = { ...original, ...change };
    await assert.rejects(checkout.reconcile('provider-order')); assert.equal(calls.length, before); truth = original;
  }
  truth = { ...truth, status: 'failed', total_paid_amount: '0' };
  await checkout.reconcile('provider-order'); assert.equal(calls.at(-1)?.command, 'reject');
});

test('fulfillment retries preserve stable operation key and fence; no job makes no supplier call', async () => {
  const calls: any[] = []; let attempts = 0; let done = false;
  const store = async (command: string, args: any) => {
    calls.push({ command, args });
    if (command === 'claim_fulfillment') return { job: done ? null : { id: 'job', order_id: 'order', owner: 'worker', generation: ++attempts } };
    if (command === 'finish_fulfillment') done = true;
    return { ok: true };
  };
  const keys: string[] = [];
  const adapter = async (job: any, key: string) => {
    keys.push(key); assert.equal(job.order_id, 'order');
    if (keys.length === 1) throw new Error('SIMULATED_FAILURE');
    return { reference: 'manual-task' };
  };
  await assert.rejects(runFulfillmentJob(store, 'worker', adapter), /SIMULATED_FAILURE/);
  await runFulfillmentJob(store, 'worker', adapter);
  await runFulfillmentJob(store, 'worker', adapter);
  assert.deepEqual(keys, ['fulfillment-order', 'fulfillment-order']);
  assert.equal(calls.find(call => call.command === 'retry_fulfillment').args.generation, 1);
});

test('rejected provider truth returns terminal state only after stock release succeeds', async () => {
  const checkout = createAtomicCheckout(async command => command === 'reject' ? { ok: true } : { paymentStatus: 'pending' }, {
    async create() { throw new Error('unused'); },
    async lookup() { return { external_reference: 'order', total_amount: 100, total_paid_amount: 0, currency_id: 'UYU', status: 'failed' }; },
  });
  assert.equal((await checkout.reconcile('provider')).paymentStatus, 'failed');
});
