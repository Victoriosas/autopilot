import test from 'node:test';
import assert from 'node:assert/strict';
import type { Product } from '../types';
import { discoverProducts, routineMatches } from './catalogDiscovery';

const product = (id: string, overrides: Partial<Product> = {}) => ({ id, status: 'published', title: 'Bruma facial', category: 'Skincare', tags: [], description: '', sku: id, price: 100, inventory: 1, rating: 0, ...overrides } as Product);
const options = { category: 'Todos', query: '', maximumPrice: Infinity, routine: 'all' as const, inStockOnly: false, sort: 'featured' as const };

test('search ignores accents, case and whitespace and matches all query words across fields', () => {
  const item = product('SKU-Á', { title: 'Sérum facial', tags: ['Hidratación'] });
  assert.deepEqual(discoverProducts([item], { ...options, query: '  SERUM hidratacion  ' }), [item]);
  assert.deepEqual(discoverProducts([item], { ...options, query: 'sku-a' }), [item]);
  assert.deepEqual(discoverProducts([item], { ...options, query: 'serum inexistente' }), []);
});

test('filters never expose unpublished products and combine category, budget and recorded stock', () => {
  const items = [product('ok'), product('draft', { status: 'draft' as Product['status'] }), product('empty', { inventory: 0 }), product('unknown', { inventory: NaN }), product('expensive', { price: 200 }), product('other', { category: 'Spa' })];
  assert.deepEqual(discoverProducts(items, { ...options, category: 'Skincare', maximumPrice: 100, inStockOnly: true }).map(p => p.id), ['ok']);
});

test('routine uses explicit catalog metadata and relevant product names without unsupported classification', () => {
  assert.equal(routineMatches(product('a', { title: 'Vincha facial', category: 'Belleza' }), 'accessories'), true);
  assert.equal(routineMatches(product('b', { title: 'Gua sha', category: 'Belleza' }), 'tools'), true);
  assert.equal(routineMatches(product('c', { title: 'Vaporizador facial', category: 'Belleza' }), 'spa'), true);
  assert.equal(routineMatches(product('d', { title: 'Organizador', category: 'Hogar', description: 'Ideal junto al skincare' }), 'skincare'), false);
});

test('price sorting is deterministic and does not mutate source catalog', () => {
  const items = [product('b', { price: 200 }), product('a'), product('c', { price: 100 })];
  assert.deepEqual(discoverProducts(items, { ...options, sort: 'price_asc' }).map(p => p.id), ['a', 'c', 'b']);
  assert.deepEqual(discoverProducts(items, { ...options, sort: 'price_desc' }).map(p => p.id), ['b', 'a', 'c']);
  assert.deepEqual(items.map(p => p.id), ['b', 'a', 'c']);
});

test('invalid prices are not offered and zero maximum is respected', () => {
  assert.deepEqual(discoverProducts([product('nan', { price: NaN }), product('negative', { price: -1 }), product('ok')], { ...options, maximumPrice: 0 }), []);
});
