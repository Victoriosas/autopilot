import assert from 'node:assert/strict';
import test from 'node:test';
import { calculatePricingQuote, type PricingStrategy } from './pricingEngine';

test('rounding preserves the required floor and target margin', () => {
  for (const supplierCost of [0.01, 0.57, 5.7, 11.4, 57, 570]) {
    const quote = calculatePricingQuote({ supplierCost });
    const floorMinimum = supplierCost / (1 - 0.08 - 0.20);
    const recommendedMinimum = supplierCost / (1 - 0.08 - 0.35);
    assert.ok(quote.floorPrice >= floorMinimum, `floor for cost ${supplierCost}`);
    assert.ok(quote.recommendedPrice >= recommendedMinimum, `target for cost ${supplierCost}`);
    assert.ok(quote.premiumCeiling >= quote.recommendedPrice);
  }
});

test('unknown API strategy fails instead of returning NaN prices', () => {
  assert.throws(() => calculatePricingQuote({
    supplierCost: 10,
    strategy: 'invalid' as PricingStrategy,
  }), /Unknown pricing strategy/);
});
