import test from 'node:test';
import assert from 'node:assert/strict';
import { beautyDiscoveryPlan } from './beautyDiscoveryPlan';
import { sourcingConfig } from './sourcingEvidence';
import { assessVictoriosaFit } from './victoriosaProductFilter';

test('six-hour discovery rotates focused beauty goals deterministically and preserves explicit searches', () => {
  const base = sourcingConfig({});
  const plans = Array.from({ length: 8 }, (_, slot) => beautyDiscoveryPlan(base, slot));
  assert.equal(new Set(plans.map(plan => plan.keyword)).size, 8);
  assert.deepEqual(beautyDiscoveryPlan(base, 8), plans[0]);
  assert.equal(beautyDiscoveryPlan(base, 1, 'custom facial roller').keyword, 'custom facial roller');
  for (const plan of plans) { assert.equal(plan.mode, 'shadow'); assert.equal(plan.maxAiCalls, base.maxAiCalls); }
});

test('cosmetics and powered facial devices cannot bypass regulatory review by alternate wording', () => {
  for (const title of ['Facial mist', 'Hydrogel eye patches', 'Face essence', 'LED face mask', 'Facial steamer']) {
    const fit = assessVictoriosaFit({ title } as any, {});
    assert.equal(fit.decision, 'review', title); assert.equal(fit.regulatoryReviewRequired, true);
  }
  assert.equal(assessVictoriosaFit({ title: 'Facial headband' } as any, {}).decision, 'eligible');
  assert.equal(assessVictoriosaFit({ title: 'Face serum cures eczema' } as any, {}).decision, 'reject');
});
