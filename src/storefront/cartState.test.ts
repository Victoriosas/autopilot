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