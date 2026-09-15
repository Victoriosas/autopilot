import test from 'node:test';
import assert from 'node:assert/strict';
import { assessVenture } from './ventureLab';

test('venture lab fails closed when evidence is incomplete', () => {
  const result = assessVenture({
    vertical: 'home_organization',
    query: 'under sink organizer',
    marketPriceUyu: null,
    landedCostUyu: 400,
    netMarginPct: null,
    demandScore: 70,
    competitionScore: 60,
    shippingSharePct: 20,
    returnRisk: 'low',
    regulatoryRisk: 'low',
    sourceCount: 1,
    observedAt: new Date().toISOString(),
  });
  assert.equal(result.decision, 'watch');
  assert.equal(result.score, 0);
  assert.ok(result.reasons.includes('INSUFFICIENT_MARKET_SOURCES'));
});

test('venture lab can mark a well-evidenced low-risk item as promising', () => {
  const result = assessVenture({
    vertical: 'pet_accessories',
    query: 'dog car seat cover',
    marketPriceUyu: 849,
    landedCostUyu: 320,
    netMarginPct: 38,
    demandScore: 74,
    competitionScore: 55,
    shippingSharePct: 18,
    returnRisk: 'low',
    regulatoryRisk: 'low',
    sourceCount: 3,
    observedAt: new Date().toISOString(),
  });
  assert.equal(result.decision, 'promising');
  assert.ok(result.score >= 55);
});

test('venture lab rejects high regulatory risk even with attractive margin', () => {
  const result = assessVenture({
    vertical: 'beauty_accessories',
    query: 'regulated device',
    marketPriceUyu: 3000,
    landedCostUyu: 700,
    netMarginPct: 50,
    demandScore: 85,
    competitionScore: 40,
    shippingSharePct: 15,
    returnRisk: 'medium',
    regulatoryRisk: 'high',
    sourceCount: 4,
    observedAt: new Date().toISOString(),
  });
  assert.equal(result.decision, 'reject');
  assert.ok(result.reasons.includes('VENTURE_FAILS_OWNER_GUARDRAILS'));
});
