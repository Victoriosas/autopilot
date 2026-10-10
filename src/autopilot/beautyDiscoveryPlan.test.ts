import test from 'node:test';
import assert from 'node:assert/strict';
import { beautyDiscoveryPlan } from './beautyDiscoveryPlan';
import { sourcingConfig } from './sourcingEvidence';
import { assessVictoriosaFit } from './victoriosaProductFilter';
import express from 'express';
import { once } from 'node:events';
import { createSourcingRouter } from './sourcingRouter';

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

test('medical claims and permanent wrinkle promises are rejected in Spanish and English', () => {
  for (const title of ['Facial roller cura el acné', 'Hair brush cures alopecia', 'Facial roller guaranteed permanent wrinkle removal', 'Rodillo facial elimina definitivamente las arrugas']) {
    assert.equal(assessVictoriosaFit({ title } as any, {}).decision, 'reject', title);
  }
  assert.equal(assessVictoriosaFit({ title: 'Rodillo facial' } as any, { description: 'Elimina definitivamente\nlas arrugas' }).decision, 'reject');
});

test('authenticated cron uses a single slot for the discovery plan and durable retry key', async () => {
  const keys = ['CRON_SECRET', 'AUTOPILOT_V4_SOURCING_ENABLED', 'AUTOPILOT_V4_KEYWORD'] as const;
  const before = keys.map(key => process.env[key]);
  const originalNow = Date.now;
  const received: { keyword: string; key: string }[] = [];
  process.env.CRON_SECRET = 'fixture-beauty-cron';
  process.env.AUTOPILOT_V4_SOURCING_ENABLED = 'true';
  delete process.env.AUTOPILOT_V4_KEYWORD;
  Date.now = () => 7 * 21600000;
  const app = express();
  app.use(createSourcingRouter(() => ({} as any), undefined, async (_store, config, key) => {
    received.push({ keyword: config.keyword, key });
    return { status: 'completed_no_candidates' } as any;
  }));
  const server = app.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const url = `http://127.0.0.1:${(server.address() as any).port}/cron/sourcing`;
    assert.equal((await fetch(url)).status, 401);
    for (let retry = 0; retry < 2; retry++) {
      assert.equal((await fetch(url, { headers: { authorization: 'Bearer fixture-beauty-cron' } })).status, 200);
    }
    assert.deepEqual(received, [{ keyword: 'face essence', key: 'cron:7' }, { keyword: 'face essence', key: 'cron:7' }]);
  } finally {
    Date.now = originalNow;
    keys.forEach((key, index) => { if (before[index] === undefined) delete process.env[key]; else process.env[key] = before[index]; });
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
