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
  let expected = 100;
  let providerTotal: number | string = 100;
  let paidTotal: number | string = 100;
  let providerStatus = 'processed';
  let writes = 0;
  t.mock.method(globalThis, 'fetch', async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === '127.0.0.1') return nativeFetch(input, init);
    if (url.hostname === 'api.mercadopago.com') {
      assert.equal(url.pathname, '/v1/orders/test-order');
      return Response.json({ external_reference: 'local-order', total_amount: providerTotal, total_paid_amount: paidTotal, status: providerStatus, currency_id: 'UYU' });
    }
    assert.equal(url.hostname, 'payments.example.test', 'real services must not be called');
    if (url.pathname === '/rest/v1/audit_logs') return new Response(null, { status: 201 });
    assert.equal(url.pathname, '/rest/v1/orders');
    if (init?.method === 'PATCH') {
      writes++;
      assert.equal(JSON.parse(String(init.body)).payment_status, 'paid');
      return new Response(null, { status: 204 });
    }
    return Response.json({ id: 'local-order', total: expected, currency: 'UYU', payment_method: 'mercadopago', payment_status: 'pending', provider_order_id: 'test-order' });
  });
  const app = express(); app.use(express.json()); app.use('/mp', createMercadoPagoRouter());
  const server = createServer(app).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as { port: number };
  const reconcile = () => fetch(`http://127.0.0.1:${port}/mp/reconcile`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerOrderId: 'test-order' }),
  });
  try {
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
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
