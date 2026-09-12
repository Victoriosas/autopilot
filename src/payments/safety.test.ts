import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { orderIdentity, assertPaymentAmount, assertStock, validateCheckoutItems } from './safety';
import { createPaymentV2Router } from './paypalV2';
import { createMercadoPagoRouter } from './mercadoPago';
const id = '12345678-1234-4234-8234-123456789012';

test('order persistence uses UUID and a separate customer reference', () => {
  const order = orderIdentity('TR');
  assert.match(order.id, /^[a-f0-9-]{36}$/);
  assert.match(order.orderNumber, /^VIC-TR-/);
  assert.notEqual(order.id, order.orderNumber);
});
test('checkout rejects duplicates, invalid quantities, null items and unsupported variants', () => {
  for (const items of [[null], [{ productId: id, quantity: 0 }], [{ productId: id, quantity: '1' }], [{ productId: id, quantity: 1 }, { productId: id, quantity: 1 }], [{ productId: id, quantity: 1, selectedVariant: 'Large' }]]) {
    assert.throws(() => validateCheckoutItems(items));
  }
  assert.equal(validateCheckoutItems([{ productId: id, quantity: 2 }])[0].quantity, 2);
});
test('unknown currency and missing or insufficient stock block checkout', () => {
  process.env.STORE_CURRENCY = 'UYU';
  assert.throws(() => assertStock({ inventory: 10 }, 1), /CURRENCY/);
  assert.throws(() => assertStock({ inventory: null, currency: 'UYU' }, 1), /STOCK/);
  assert.throws(() => assertStock({ inventory: 1, currency: 'UYU' }, 2), /STOCK/);
  assert.doesNotThrow(() => assertStock({ inventory: 2, currency: 'UYU' }, 2));
});
test('payment amount comparison rejects a cent short, wrong currency and non-finite amounts', () => {
  assert.throws(() => assertPaymentAmount(10, 9.99, 'USD', 'USD'));
  assert.throws(() => assertPaymentAmount(10, 10, 'USD', 'UYU'));
  assert.throws(() => assertPaymentAmount(10, NaN, 'USD', 'USD'));
  assert.doesNotThrow(() => assertPaymentAmount(10, '10.00', 'USD', 'USD'));
});
test('disabled checkout rejects all order routes before any database or provider call', async () => {
  process.env.CHECKOUT_ENABLED = 'false';
  const app = express(); app.use(express.json());
  app.use('/v2', createPaymentV2Router()); app.use('/mp', createMercadoPagoRouter());
  const server = createServer(app).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const addr = server.address() as { port: number };
  try {
    for (const path of ['/v2/paypal/order', '/v2/transfer/order', '/mp/order']) {
      const response = await fetch(`http://127.0.0.1:${addr.port}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      assert.equal(response.status, 503, path);
    }
    const config = await fetch(`http://127.0.0.1:${addr.port}/v2/config`).then(r => r.json());
    assert.equal(config.paypalConfigured, false);
    assert.equal(config.transferConfigured, false);
  } finally { server.closeAllConnections(); server.close(); }
});
