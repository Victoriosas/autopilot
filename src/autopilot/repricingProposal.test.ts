import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRepricingProposal } from './repricingProposal';
import type { CatalogObservation } from './catalogMonitor';
const observed: CatalogObservation = {
  productId: 'pilot-item', title: 'Accesorio', source: 'cj_dropshipping',
  observedAt: '2026-10-10T23:00:00Z', currentPrice: 30, currency: 'USD',
  observedSupplierCost: 10, observedStock: 5, severity: 'info', signals: [],
  provenance: { product: 'verified', supplierCost: 'observed', stock: 'observed' },
};
const costs = {
  currency: 'USD', sourceReference: 'supplier-freight-and-owner-cost-sheet',
  supplierShipping: 5, customsRatePct: 10, paymentFeePct: 5,
  paymentFeeFixed: 1, returnReservePct: 3, acquisitionCost: 2, taxRatePct: 2,
};
// Runtime reproducer intentionally calls the current one-argument API with the
// future cost context so RED proves the omitted costs rather than a TS error.
const propose = buildRepricingProposal as (...args: any[]) => ReturnType<typeof buildRepricingProposal>;
test('missing complete costs cannot produce a commercial repricing quote', () => {
  const p = propose(observed);
  assert.equal(p.status, 'no_change');
  assert.equal(p.proposedPrice, undefined);
  assert.match(p.reason, /costos/i);
});
test('full explicit costs are included in the price and contribution', () => {
  const p = propose(observed, costs);
  assert.equal(p.status, 'review_required');
  assert.equal(p.quote?.landedCost, 18.5);
  assert.equal(p.quote?.breakdown.supplierShipping, 5);
  assert.equal(p.quote?.breakdown.paymentFee, 2.8);
});
test('unknown, malformed or mismatched costs never fall back to zero', () => {
  for (const [key, value] of [
    ['supplierShipping', undefined], ['supplierShipping', null],
    ['paymentFeePct', '5'], ['taxRatePct', NaN], ['customsRatePct', -1],
    ['currency', 'UYU'], ['sourceReference', ''],
  ] as const) {
    const p = propose(observed, { ...costs, [key]: value });
    assert.equal(p.proposedPrice, undefined, key);
    assert.equal(p.status, 'no_change', key);
  }
});
test('zero explicitly documented fees remain valid', () => {
  const p = propose(observed, { ...costs, supplierShipping: 0, customsRatePct: 0,
    paymentFeePct: 0, paymentFeeFixed: 0, returnReservePct: 0, acquisitionCost: 0, taxRatePct: 0 });
  assert.ok(p.proposedPrice && Number.isFinite(p.proposedPrice));
});
test('unknown supplier provenance and invalid current price cannot be repriced', () => {
  for (const item of [
    { ...observed, provenance: { product: 'verified' as const } },
    { ...observed, currentPrice: NaN }, { ...observed, currency: '' },
  ]) assert.equal(propose(item, costs).proposedPrice, undefined);
});
test('zero stock still blocks sale even without cost evidence', () => {
  assert.equal(propose({ ...observed, observedStock: 0 }).status, 'block_sale');
});
