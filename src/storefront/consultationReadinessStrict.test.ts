import test from 'node:test';
import assert from 'node:assert/strict';
import { checkConsultationReadiness } from './consultationReadiness';
test('readiness requires explicit true for every local gate', async () => {
  const healthy = { enabled: () => true, configured: () => true, notificationReady: () => true, storageReady: async () => true };
  for (const gate of ['enabled', 'configured', 'notificationReady']) {
    let reads = 0;
    const deps = { ...healthy, [gate]: () => 'false', storageReady: async () => { reads++; return true; } };
    assert.equal((await checkConsultationReadiness(deps as unknown as Parameters<typeof checkConsultationReadiness>[0])).enabled, false);
    assert.equal(reads, 0);
  }
  assert.deepEqual(await checkConsultationReadiness(healthy), { enabled: true, unavailableReason: null });
});
