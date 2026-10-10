import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutShippingConfig } from './shipping';
import { mercadoPagoCredentialsReady } from './availability';

test('shipping configuration preserves cents and invalid values disable advertised payment availability', () => {
  const keys = ['STORE_SHIPPING_FLAT', 'VITE_SHIPPING_FLAT', 'STORE_FREE_SHIPPING_FROM', 'VITE_FREE_SHIPPING_FROM', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'MERCADOPAGO_ACCESS_TOKEN', 'PUBLIC_APP_URL', 'STORE_CURRENCY'] as const;
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    Object.assign(process.env, { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-only', MERCADOPAGO_ACCESS_TOKEN: 'test-only', PUBLIC_APP_URL: 'https://example.test', STORE_CURRENCY: 'UYU' });
    assert.deepEqual(checkoutShippingConfig(), { shipping: 0, freeShippingFrom: 0 });
    process.env.VITE_SHIPPING_FLAT = '0.01'; process.env.VITE_FREE_SHIPPING_FROM = '100.25';
    assert.deepEqual(checkoutShippingConfig(), { shipping: 0.01, freeShippingFrom: 100.25 });
    assert.equal(mercadoPagoCredentialsReady(), true);
    process.env.STORE_SHIPPING_FLAT = '0.015';
    assert.equal(mercadoPagoCredentialsReady(), false);
    process.env.STORE_SHIPPING_FLAT = '10.50';
    process.env.STORE_FREE_SHIPPING_FROM = '-1';
    assert.equal(mercadoPagoCredentialsReady(), false);
    process.env.STORE_FREE_SHIPPING_FROM = '0';
    for (const key of ['STORE_SHIPPING_FLAT', 'STORE_FREE_SHIPPING_FROM']) {
      process.env[key] = '100000000';
      assert.equal(mercadoPagoCredentialsReady(), false);
      assert.throws(checkoutShippingConfig, /SHIPPING_NOT_CONFIGURED/);
      process.env[key] = '0';
    }
    process.env.STORE_SHIPPING_FLAT = '10.50';
    assert.deepEqual(checkoutShippingConfig(), { shipping: 10.5, freeShippingFrom: 0 });
    assert.equal(mercadoPagoCredentialsReady(), true);
  } finally {
    for (const key of keys) if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key];
  }
});
