import test from 'node:test';
import assert from 'node:assert/strict';
import { mercadoPagoGateway } from './mercadoPago';
import { createAtomicCheckout } from './atomicCheckout';

const valid = () => ({ id: 'ORDTST001', type: 'online', processing_mode: 'manual', status: 'created', external_reference: 'local-order', total_amount: '250.00', currency: 'UYU', checkout_url: 'https://www.mercadopago.com.uy/checkout/v1/redirect?order_id=ORDTST001' });
const snapshot = { orderId: 'local-order', total: 250, shipping: 50, items: [{ title: 'Vincha', price: 100, quantity: 2 }] };
const request = { returnUrl: 'https://example.test', customer: { email: 'buyer@example.test' } };

test('gateway rejects mismatched order truth and unsafe checkout destinations before returning a handoff', async t => {
  const old = process.env.MERCADOPAGO_ACCESS_TOKEN;
  process.env.MERCADOPAGO_ACCESS_TOKEN = 'test-only-token';
  let response: any = valid();
  t.mock.method(globalThis, 'fetch', async () => Response.json(response));
  try {
    assert.equal((await mercadoPagoGateway.create(snapshot, request)).id, 'ORDTST001');
    const invalid = [
      { id: '' }, { id: 'bad/id' }, { external_reference: 'another-order' },
      { total_amount: '249.99' }, { total_amount: '2.5e2' }, { total_amount: 250 }, { currency: 'USD' },
      { currency_id: 'USD' }, { type: 'point' }, { processing_mode: 'automatic' }, { status: 'processed' },
      { checkout_url: 'javascript:alert(1)' }, { checkout_url: 'http://www.mercadopago.com.uy/checkout/v1/redirect?order_id=ORDTST001' },
      { checkout_url: 'https://www.mercadopago.com.uy.attacker.test/checkout/v1/redirect?order_id=ORDTST001' },
      { checkout_url: 'https://www.mercadopago.com.uy@attacker.test/checkout/v1/redirect?order_id=ORDTST001' },
      { checkout_url: 'https://user@www.mercadopago.com.uy/checkout/v1/redirect?order_id=ORDTST001' },
      { checkout_url: 'https://www.mercadopago.com.uy:444/checkout/v1/redirect?order_id=ORDTST001' },
      { checkout_url: 'https://www.mercadopago.com.uy/other?order_id=ORDTST001' },
      { checkout_url: 'https://www.mercadopago.com.uy/checkout/v1/redirect?order_id=OTHER' },
      { checkout_url: 'https://www.mercadopago.com.uy/checkout/v1/redirect?order_id=ORDTST001&order_id=OTHER' },
    ];
    for (const patch of invalid) {
      response = { ...valid(), ...patch };
      await assert.rejects(mercadoPagoGateway.create(snapshot, request), /MERCADOPAGO_ORDER_CREATE_FAILED/, JSON.stringify(patch));
    }
    for (const value of [null, [], {}, 'invalid']) {
      response = value;
      await assert.rejects(mercadoPagoGateway.create(snapshot, request), /MERCADOPAGO_ORDER_CREATE_FAILED/);
    }
  } finally {
    if (old === undefined) delete process.env.MERCADOPAGO_ACCESS_TOKEN; else process.env.MERCADOPAGO_ACCESS_TOKEN = old;
  }
});

test('invalid provider handoff never binds a URL or releases uncertain reserved stock', async t => {
  const old = process.env.MERCADOPAGO_ACCESS_TOKEN;
  process.env.MERCADOPAGO_ACCESS_TOKEN = 'test-only-token';
  const commands: string[] = [];
  t.mock.method(globalThis, 'fetch', async () => Response.json({ ...valid(), checkout_url: 'https://attacker.test/pay' }));
  const checkout = createAtomicCheckout(async command => {
    commands.push(command);
    if (command === 'reserve') return { ...snapshot, state: 'held', expired: false };
    return {};
  }, mercadoPagoGateway);
  try {
    await assert.rejects(checkout.start(request), /MERCADOPAGO_ORDER_CREATE_FAILED/);
    assert.deepEqual(commands, ['reserve', 'begin_provider']);
  } finally {
    if (old === undefined) delete process.env.MERCADOPAGO_ACCESS_TOKEN; else process.env.MERCADOPAGO_ACCESS_TOKEN = old;
  }
});
