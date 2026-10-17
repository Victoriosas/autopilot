import test from 'node:test';
import assert from 'node:assert/strict';
import { readCatalogLocation, writeCatalogLocation } from './catalogLocation';

test('shared catalog links restore query and category', () => {
  assert.deepEqual(readCatalogLocation('?q=gua+sha&category=Rostro'), { query: 'gua sha', category: 'Rostro' });
  assert.deepEqual(readCatalogLocation('?category=unknown'), { query: '', category: 'Todos' });
});

test('catalog navigation preserves payment parameters and clears only its own filters', () => {
  const updated = writeCatalogLocation('https://example.test/?payment_id=123#catalogo', { query: 'vincha rosa', category: 'Kits' });
  const url = new URL(updated);
  assert.equal(url.searchParams.get('payment_id'), '123');
  assert.equal(url.searchParams.get('q'), 'vincha rosa');
  assert.equal(url.hash, '#catalogo');
  const cleared = new URL(writeCatalogLocation(updated, { query: '', category: 'Todos' }));
  assert.equal(cleared.searchParams.has('q'), false);
  assert.equal(cleared.searchParams.has('category'), false);
  assert.equal(cleared.searchParams.get('payment_id'), '123');
});
