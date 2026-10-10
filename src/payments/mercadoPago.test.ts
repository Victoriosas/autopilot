// Legacy direct order writes were replaced by the PostgreSQL RPC; its invariants
// are tested against PostgreSQL, while these tests exercise the real HTTP adapter.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mercadoPagoGateway } from './mercadoPago';

test('Mercado Pago adapter retries the identical server-priced payload and provider key', async (t) => {
  const old = process.env.MERCADOPAGO_ACCESS_TOKEN; process.env.MERCADOPAGO_ACCESS_TOKEN = 'test-only-token';
  const requests: Array<{ key: string; body: string }> = [];
  let failure = false;
  t.mock.method(globalThis, 'fetch', async (input: any, init: RequestInit) => {
    assert.equal(String(input), 'https://api.mercadopago.com/v1/orders');
    requests.push({ key: new Headers(init.headers).get('X-Idempotency-Key')!, body: String(init.body) });
    if (failure) return Response.json({ code: 'TEST_PROVIDER_ERROR' }, { status: 400 });
    return Response.json({ id: 'provider-order', checkout_url: 'https://example.test/pay' });
  });
  try {
    const snapshot = { orderId: 'server-order', total: 250, shipping: 50, items: [{ title: 'Vincha', price: 100, quantity: 2 }] };
    const request = { returnUrl: 'https://example.test', customer: { email: 'buyer@example.test' } };
    const result = await mercadoPagoGateway.create(snapshot, request);
    await mercadoPagoGateway.create(snapshot, request);
    assert.equal(result.id, 'provider-order'); assert.deepEqual(requests[0], requests[1]);
    assert.equal(requests[0].key, 'server-order');
    const body = JSON.parse(requests[0].body);
    assert.equal(body.total_amount, '250.00'); assert.equal(body.external_reference, 'server-order');
    assert.equal(body.items[0].total_amount, '200.00'); assert.equal(body.items[1].total_amount, '50.00');
    failure = true;
    await assert.rejects(mercadoPagoGateway.create(snapshot, request), /MERCADOPAGO_ORDER_CREATE_FAILED/);
  } finally { if (old === undefined) delete process.env.MERCADOPAGO_ACCESS_TOKEN; else process.env.MERCADOPAGO_ACCESS_TOKEN = old; }
});

test('Mercado Pago lookup fetches provider truth and rejects unavailable responses', async (t) => {
  const old = process.env.MERCADOPAGO_ACCESS_TOKEN; process.env.MERCADOPAGO_ACCESS_TOKEN = 'test-only-token';
  let status = 200;
  t.mock.method(globalThis, 'fetch', async (input: any) => {
    assert.equal(String(input), 'https://api.mercadopago.com/v1/orders/provider-order');
    return Response.json({ status: 'processed', external_reference: 'server-order', total_amount: '100', total_paid_amount: '100', currency_id: 'UYU' }, { status });
  });
  try {
    assert.equal((await mercadoPagoGateway.lookup('provider-order')).status, 'processed');
    status = 503; await assert.rejects(mercadoPagoGateway.lookup('provider-order'), /LOOKUP_FAILED/);
    delete process.env.MERCADOPAGO_ACCESS_TOKEN;
    await assert.rejects(mercadoPagoGateway.lookup('provider-order'), /NOT_CONFIGURED/);
  } finally { if (old === undefined) delete process.env.MERCADOPAGO_ACCESS_TOKEN; else process.env.MERCADOPAGO_ACCESS_TOKEN = old; }
});
