import test from 'node:test';
import assert from 'node:assert/strict';
import type { Product } from '../types';
import { cartLimit, restoreCart } from './cartState';

const product = (overrides: Partial<Product> = {}): Product => ({
  id: '11111111-1111-4111-8111-111111111111',
  status: 'published', title: 'Producto', originalTitle: 'Producto', slug: 'producto',
  category: 'Belleza', tags: [], brand: 'Victoriosa', description: '', features: [], specs: {},
  images: [], originalImages: [], price: 100, costPrice: 50, inventory: 8, sku: 'SKU-1',
  badges: [], rating: 0, reviewCount: 0,
  traceability: {} as Product['traceability'],
  ...overrides,
});

test('cart limit fails closed for unavailable inventory and caps checkout quantity at 20', () => {
  assert.equal(cartLimit(product({ inventory: 0 })), 0);
  assert.equal(cartLimit(product({ inventory: 2 })), 2);
  assert.equal(cartLimit(product({ inventory: 50 })), 20);
  assert.equal(cartLimit(product({ status: 'draft' as Product['status'] })), 0);
});

test('restoreCart keeps only published products and clamps quantities to current stock', () => {
  const available = product({ inventory: 3 });
  const draft = product({ id: '22222222-2222-4222-8222-222222222222', status: 'draft' as Product['status'] });
  const restored = restoreCart([
    { productId: available.id, quantity: 10 },
    { productId: draft.id, quantity: 1 },
    { productId: 'missing', quantity: 1 },
  ], [available, draft]);
  assert.equal(restored.length, 1);
  assert.equal(restored[0].quantity, 3);
});

test('cart limit rejects malformed inventory without coercing it into stock', () => {
  for (const inventory of ['3', true, null, undefined, NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(cartLimit(product({ inventory: inventory as number })), 0, `inventory=${String(inventory)}`);
  }
});

test('restoring persisted cart drops products with malformed live stock', () => {
  const invalid = product({ inventory: '3' as unknown as number });
  assert.deepEqual(restoreCart([{ productId: invalid.id, quantity: 1 }], [invalid]), []);
});

test('restoreCart merges identical variants and shares the stock limit across variants', () => {
  const available = product({ inventory: 5 });
  const restored = restoreCart([
    { productId: available.id, quantity: 2, selectedVariant: ' rosa ' },
    { product: { id: available.id }, quantity: 2, selectedVariant: 'rosa' },
    { productId: available.id, quantity: 3, selectedVariant: 'blanco' },
    { productId: available.id, quantity: 1 },
  ], [available]);
  assert.deepEqual(restored.map(({ quantity, selectedVariant }) => ({ quantity, selectedVariant })), [
    { quantity: 4, selectedVariant: 'rosa' },
    { quantity: 1, selectedVariant: 'blanco' },
  ]);
});

test('restoreCart ignores malformed persisted entries and normalizes empty variants', () => {
  const available = product();
  assert.deepEqual(restoreCart(null, [available]), []);
  const restored = restoreCart([
    null, 'invalid', {},
    { productId: available.id, quantity: '1' },
    { productId: available.id, quantity: 0 },
    { productId: available.id, quantity: 1.5 },
    { productId: available.id, quantity: 1, selectedVariant: '  ' },
  ], [available]);
  assert.deepEqual(restored, [{ product: available, quantity: 1, selectedVariant: undefined }]);
});
