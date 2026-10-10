import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createMercadoPagoRouter } from './mercadoPago';

test('atomic HTTP checkout forwards only server-approved intent and reuses the provider operation', async () => {
  const old = process.env.CHECKOUT_ENABLED; process.env.CHECKOUT_ENABLED = 'false';
  let checkoutUrl: string | null = null; let available = true; let charges = 0;
  const operations = new Map();
  const router = createMercadoPagoRouter({
    available: async () => ({ requested: true, available, reason: null }),
    command: async (command: string, args: any) => {
      if (command === 'reserve') {
        assert.equal(args.key, 'stable-client-checkout-key'); assert.equal(args.total, undefined);
        assert.equal(args.shipping, Number(process.env.STORE_SHIPPING_FLAT || '0'));
        return { orderId: 'server-order', state: 'held', total: 100, currency: 'UYU', items: [], shipping: 0, checkoutUrl };
      }
      if (command === 'bind') { checkoutUrl = args.checkoutUrl; return { ok: true }; }
      return { paymentStatus: 'paid' };
    },
    gateway: {
      async create(snapshot: any) {
        if (!operations.has(snapshot.orderId)) { charges++; operations.set(snapshot.orderId, { id: 'provider-order', checkoutUrl: 'https://example.test/pay' }); }
        return operations.get(snapshot.orderId);
      },
      async lookup() { return { external_reference: 'server-order', total_amount: 100, total_paid_amount: 100, currency_id: 'UYU', status: 'processed' }; },
    },
  });
  const app = express(); app.use(express.json()); app.use('/mp', router);
  const server = createServer(app).listen(0, '127.0.0.1'); await once(server, 'listening');
  const { port } = server.address() as { port: number };
  const body = { customer: { name: 'Test', email: 'buyer@example.test', phone: '099123456', address: 'Calle 1', city: 'Montevideo', postalCode: '11000', country: 'UY' }, items: [{ productId: '11111111-1111-4111-8111-111111111111', quantity: 1 }], total: 1, shipping: 1 };
  const post = (headers: object = { 'Idempotency-Key': 'stable-client-checkout-key' }) => fetch(`http://127.0.0.1:${port}/mp/order`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
  try {
    const results = await Promise.all([post(), post()]);
    for (const result of results) { assert.equal(result.status, 201); assert.equal((await result.json()).orderId, 'server-order'); }
    assert.equal(charges, 1);
    assert.equal((await post()).status, 201); assert.equal(charges, 1);
    assert.equal((await post({})).status, 400);
    available = false;
    assert.equal((await post()).status, 503); assert.equal(charges, 1);
    const configuration = await (await fetch(`http://127.0.0.1:${port}/mp/config`)).json();
    assert.equal(configuration.configured, false);
  } finally {
    if (old === undefined) delete process.env.CHECKOUT_ENABLED; else process.env.CHECKOUT_ENABLED = old;
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('HTTP key replacement is authorized only by verified released database state', async () => {
  let snapshot: any = { state: 'released', expired: true };
  let forged = false;
  let gatewayCalls = 0;
  const app = express(); app.use(express.json());
  app.use('/mp', createMercadoPagoRouter({
    available: async () => ({ requested: true, available: true, reason: null }),
    command: async () => {
      if (forged) throw Object.assign(new Error('CHECKOUT_RESERVATION_RELEASED'), { retryAllowed: true });
      return snapshot;
    },
    gateway: { async create() { gatewayCalls++; throw new Error('must not call'); }, async lookup() { throw new Error('unused'); } },
  }));
  const server = createServer(app).listen(0, '127.0.0.1'); await once(server, 'listening');
  const { port } = server.address() as { port: number };
  const post = () => fetch(`http://127.0.0.1:${port}/mp/order`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'stable-client-checkout-key' },
    body: JSON.stringify({ customer: { name: 'Test', email: 'buyer@example.test', phone: '099123456', address: 'Calle 1', city: 'Montevideo', postalCode: '11000', country: 'UY' }, items: [{ productId: '11111111-1111-4111-8111-111111111111', quantity: 1 }], retryAllowed: true }),
  });
  try {
    const released = await post(); assert.equal(released.status, 409);
    assert.equal((await released.json()).retryAllowed, true);
    for (const state of ['held', 'paid']) {
      snapshot = { state, expired: true };
      const response = await post();
      assert.notEqual((await response.json()).retryAllowed, true);
    }
    forged = true;
    assert.notEqual((await (await post()).json()).retryAllowed, true);
    assert.equal(gatewayCalls, 0);
  } finally {
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
