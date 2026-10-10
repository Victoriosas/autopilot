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

test('Mercado Pago availability rejects unsupported currency and invalid production return URLs', async () => {
  const env = {
    CHECKOUT_ENABLED: 'true', SUPABASE_URL: 'https://payments.example.test',
    SUPABASE_SERVICE_ROLE_KEY: 'test-only-key', MERCADOPAGO_ACCESS_TOKEN: 'test-only-token',
    PUBLIC_APP_URL: 'https://store.example.test', STORE_CURRENCY: 'UYU', NODE_ENV: 'production',
  };
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  const app = express(); app.use('/mp', createMercadoPagoRouter());
  const server = createServer(app).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as { port: number };
  const config = async () => {
    const response = await fetch(`http://127.0.0.1:${port}/mp/config`);
    assert.equal(response.status, 200);
    return response.json();
  };
  try {
    assert.equal((await config()).configured, false, 'credentials alone do not prove operational checkout');
    process.env.STORE_CURRENCY = 'USD';
    assert.equal((await config()).configured, false, 'unsupported currency must hide the payment option');
    process.env.STORE_CURRENCY = 'UYU';
    for (const url of ['invalid-url', 'http://store.example.test']) {
      process.env.PUBLIC_APP_URL = url;
      assert.equal((await config()).configured, false, `invalid production return URL: ${url}`);
    }
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('legacy payment creation stays unavailable even when the raw checkout flag is enabled', async () => {
  const env = { CHECKOUT_ENABLED: 'true', COMMERCE_ATOMIC_CHECKOUT_ENABLED: 'false', SUPABASE_URL: 'https://payments.example.test', SUPABASE_SERVICE_ROLE_KEY: 'test-key', BANK_TRANSFER_PUBLIC_INSTRUCTIONS: 'test-only', PAYPAL_CLIENT_ID: 'test-id', PAYPAL_CLIENT_SECRET: 'test-secret', PAYPAL_ENV: 'live', PAYPAL_WEBHOOK_ID: 'test-hook', PAYPAL_STORE_TO_USD_RATE: '1' };
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]])); Object.assign(process.env, env);
  const app = express(); app.use(express.json()); app.use('/v2', createPaymentV2Router());
  const server = createServer(app).listen(0, '127.0.0.1'); await once(server, 'listening');
  const { port } = server.address() as { port: number };
  try {
    const config = await (await fetch(`http://127.0.0.1:${port}/v2/config`)).json();
    assert.equal(config.checkoutEnabled, false); assert.equal(config.checkoutRequested, true);
    assert.equal(config.paypalConfigured, false); assert.equal(config.transferConfigured, false);
    for (const route of ['paypal/order', 'transfer/order']) {
      const response = await fetch(`http://127.0.0.1:${port}/v2/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      assert.equal(response.status, 503);
    }
  } finally {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
