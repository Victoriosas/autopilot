import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentAvailability } from './availability';

test('availability fails closed without deployed atomic RPC and current provider/fulfillment evidence', async () => {
  const original = process.env.CHECKOUT_ENABLED;
  const atomic = process.env.COMMERCE_ATOMIC_CHECKOUT_ENABLED;
  process.env.CHECKOUT_ENABLED = 'true'; process.env.COMMERCE_ATOMIC_CHECKOUT_ENABLED = 'true';
  try {
    assert.equal((await paymentAvailability('mercadopago', true, async () => { throw new Error('missing migration'); })).available, false);
    assert.equal((await paymentAvailability('mercadopago', true, async () => ({ available: false, atomicCheckout: true }))).available, false);
    assert.equal((await paymentAvailability('mercadopago', false, async () => ({ available: true }))).available, false);
    assert.equal((await paymentAvailability('mercadopago', true, async () => ({ available: true, atomicCheckout: true, fulfillmentQueue: true }))).available, true);
    assert.equal((await paymentAvailability('paypal', true, async () => ({ available: true, atomicCheckout: true, fulfillmentQueue: true }))).available, false);
    process.env.CHECKOUT_ENABLED = 'false';
    assert.equal((await paymentAvailability('mercadopago', true, async () => ({ available: true }))).available, false);
  } finally {
    if (original === undefined) delete process.env.CHECKOUT_ENABLED; else process.env.CHECKOUT_ENABLED = original;
    if (atomic === undefined) delete process.env.COMMERCE_ATOMIC_CHECKOUT_ENABLED; else process.env.COMMERCE_ATOMIC_CHECKOUT_ENABLED = atomic;
  }
});
