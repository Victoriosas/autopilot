import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createMercadoPagoRouter } from './mercadoPago';

test('Mercado Pago reconciliation never marks invalid or incomplete amounts paid', async (t) => {
  const env = { SUPABASE_URL: 'https://payments.example.test', SUPABASE_SERVICE_ROLE_KEY: 'test-only-key', MERCADOPAGO_ACCESS_TOKEN: 'test-only-token' };
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  const nativeFetch = globalThis.fetch;
  let expected: number | string = 100;
  let providerTotal: number | string = 100;
  let paidTotal: number | string = 100;
  let providerStatus = 'processed';
  let externalReference = 'local-order';
  let localMethod = 'mercadopago';
  let localProviderId = 'test-order';
  let writes = 0;
  t.mock.method(globalThis, 'fetch', async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === '127.0.0.1') return nativeFetch(input, init);
    if (url.hostname === 'api.mercadopago.com') {
      assert.equal(url.pathname, '/v1/orders/test-order');
      return Response.json({ external_reference: externalReference, total_amount: providerTotal, total_paid_amount: paidTotal, status: providerStatus, currency_id: 'UYU' });
    }
    assert.equal(url.hostname, 'payments.example.test', 'real services must not be called');
    if (url.pathname === '/rest/v1/audit_logs') return new Response(null, { status: 201 });
    assert.equal(url.pathname, '/rest/v1/orders');
    if (init?.method === 'PATCH') {
      writes++;
      assert.equal(JSON.parse(String(init.body)).payment_status, 'paid');
      return new Response(null, { status: 204 });
    }
    return Response.json({ id: 'local-order', total: expected, currency: 'UYU', payment_method: localMethod, payment_status: 'pending', provider_order_id: localProviderId });
  });
  const app = express(); app.use(express.json()); app.use('/mp', createMercadoPagoRouter());
  const server = createServer(app).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as { port: number };
  const reconcile = () => fetch(`http://127.0.0.1:${port}/mp/reconcile`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerOrderId: 'test-order' }),
  });
  try {
    externalReference = '';
    assert.equal((await reconcile()).status, 400);
    externalReference = 'local-order'; localMethod = 'paypal';
    assert.equal((await reconcile()).status, 400);
    localMethod = 'mercadopago'; localProviderId = 'other-order';
    assert.equal((await reconcile()).status, 400);
    localProviderId = 'test-order';
    assert.equal(writes, 0);
    for (const invalid of ['Infinity', 'NaN', -1]) {
      paidTotal = invalid;
      const response = await reconcile();
      assert.equal(response.status, 400, `invalid paid amount: ${invalid}`);
      assert.equal(writes, 0);
    }
    paidTotal = 100;
    for (const invalid of [0, -10]) {
      expected = invalid; providerTotal = invalid;
      assert.equal((await reconcile()).status, 400, 'nonpositive order total must be rejected');
      assert.equal(writes, 0);
    }
    for (const [local, upstream] of [['NaN', 100], ['Infinity', 100], [100, 'Infinity'], [100, 99.99]] as const) {
      expected = local; providerTotal = upstream;
      assert.equal((await reconcile()).status, 400, 'invalid or mismatched expected/provider total must fail closed');
      assert.equal(writes, 0);
    }
    expected = 100; providerTotal = 100; paidTotal = 99.99;
    const partial = await reconcile();
    assert.equal((await partial.json()).paymentStatus, 'pending');
    assert.equal(writes, 0);
    paidTotal = 100; providerStatus = 'pending';
    assert.equal((await (await reconcile()).json()).paymentStatus, 'pending');
    assert.equal(writes, 0);
    providerStatus = 'processed';
    const completed = await reconcile();
    assert.equal(completed.status, 200);
    assert.equal((await completed.json()).paymentStatus, 'paid');
    assert.equal(writes, 1);
    const empty = await fetch(`http://127.0.0.1:${port}/mp/webhook`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.deepEqual(await empty.json(), { received: true, reconciled: false });
    paidTotal = 'Infinity';
    const retry = await fetch(`http://127.0.0.1:${port}/mp/webhook`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { id: 'test-order' } }),
    });
    assert.equal(retry.status, 503);
    assert.equal(writes, 1);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('Mercado Pago creates a server-priced pending order and rejects unavailable inventory', async (t) => {
  const env = {
    CHECKOUT_ENABLED: 'true', SUPABASE_URL: 'https://checkout.example.test',
    SUPABASE_SERVICE_ROLE_KEY: 'test-only-key', MERCADOPAGO_ACCESS_TOKEN: 'test-only-token',
    PUBLIC_APP_URL: 'https://store.example.test', STORE_CURRENCY: 'UYU',
    STORE_SHIPPING_FLAT: '50', STORE_FREE_SHIPPING_FROM: '300',
  };
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  const nativeFetch = globalThis.fetch;
  const id = '12345678-1234-4234-8234-123456789012';
  let inventory = 5;
  let saved: Record<string, unknown> | undefined;
  let providerCalls = 0;
  let mode = 'success';
  t.mock.method(globalThis, 'fetch', async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === '127.0.0.1') return nativeFetch(input, init);
    if (url.hostname === 'api.mercadopago.com') {
      assert.equal(url.pathname, '/v1/orders');
      assert.equal(init?.method, 'POST');
      providerCalls++;
      const body = JSON.parse(String(init?.body));
      assert.equal(body.external_reference, saved?.id);
      assert.equal(body.total_amount, '250.00');
      if (mode === 'provider-error') return Response.json({ code: 'TEST_PROVIDER_ERROR' }, { status: 400 });
      return Response.json({ id: 'test-order', checkout_url: 'https://checkout.example.test/test-order' });
    }
    assert.equal(url.hostname, 'checkout.example.test', 'real services must not be called');
    if (url.pathname === '/rest/v1/products') {
      if (mode === 'lookup-error') return Response.json({ code: 'TEST_LOOKUP_ERROR' }, { status: 400 });
      if (mode === 'missing') return Response.json([]);
      return Response.json([
        { id, title: 'Vincha', price: mode === 'bad-price' ? 0 : 100, sku: 'TEST', images: [], status: mode === 'draft' ? 'draft' : 'published', inventory, currency: 'UYU' },
      ]);
    }
    if (url.pathname === '/rest/v1/audit_logs') return new Response(null, { status: 201 });
    assert.equal(url.pathname, '/rest/v1/orders');
    if (init?.method === 'POST') {
      if (mode === 'insert-error') return Response.json({ code: 'TEST_INSERT_ERROR' }, { status: 400 });
      saved = JSON.parse(String(init.body));
      return new Response(null, { status: 201 });
    }
    assert.equal(init?.method, 'PATCH');
    if (mode === 'bind-error') return Response.json({ code: 'TEST_BIND_ERROR' }, { status: 400 });
    assert.equal(JSON.parse(String(init.body)).provider_order_id, 'test-order');
    return new Response(null, { status: 204 });
  });
  const app = express(); app.use(express.json()); app.use('/mp', createMercadoPagoRouter());
  const server = createServer(app).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as { port: number };
  const order = () => fetch(`http://127.0.0.1:${port}/mp/order`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer: { fullName: 'Prueba', email: 'buyer@example.test', phone: '099123456', address: 'Calle 1', city: 'Montevideo', postalCode: '11000', country: 'Uruguay' },
      items: [{ productId: id, quantity: 2, price: 1 }], total: 2,
    }),
  });
  try {
    const created = await order();
    assert.equal(created.status, 201);
    assert.equal((await created.json()).total, 250);
    assert.equal(saved?.total, 250);
    assert.equal(saved?.payment_status, 'pending');
    assert.equal(providerCalls, 1);
    inventory = 0;
    const unavailable = await order();
    assert.equal(unavailable.status, 400);
    assert.equal((await unavailable.json()).error, 'PRODUCT_OUT_OF_STOCK');
    assert.equal(providerCalls, 1, 'out-of-stock checkout must never create a provider order');
    inventory = 5;
    for (const [scenario, error, status] of [
      ['lookup-error', 'PRODUCT_LOOKUP_FAILED', 400],
      ['missing', 'PRODUCT_NOT_FOUND', 400],
      ['draft', 'PRODUCT_NOT_AVAILABLE', 400],
      ['bad-price', 'INVALID_PRODUCT_PRICE', 400],
      ['insert-error', 'ORDER_CREATE_FAILED', 400],
      ['provider-error', 'MERCADOPAGO_ORDER_CREATE_FAILED', 502],
      ['bind-error', 'ORDER_PROVIDER_BIND_FAILED', 400],
    ] as const) {
      mode = scenario;
      const failed = await order();
      assert.equal(failed.status, status, scenario);
      assert.equal((await failed.json()).error, error, scenario);
    }
    mode = 'success';
    process.env.STORE_CURRENCY = 'USD';
    assert.equal((await order()).status, 503);
    process.env.STORE_CURRENCY = 'UYU';
    delete process.env.MERCADOPAGO_ACCESS_TOKEN;
    assert.equal((await order()).status, 503);
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'test-only-token';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.equal((await order()).status, 503);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
