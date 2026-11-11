import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, makeWindow, nextWindow, validateWindow, type HostSnapshot, type RetryEvidence, type TestWindow } from './ord204gWindowManager';

const initial: TestWindow = {
  ...makeWindow('2026-11-11T17:58:00-03:00'), authorization:'EXPLICIT', status:'PREPARED',
};
const host = (observedAt: string, overrides: Partial<HostSnapshot> = {}): HostSnapshot => ({
  observedAt, timeZone:'Montevideo Standard Time', utcOffsetMinutes:-180, task:'disabled', occupied:false, probeOk:true, ...overrides,
});
const retry: RetryEvidence = {
  reason:'second_trigger_rejected', evidenceSha256:'a'.repeat(64),
  finding:'El evento no estaba disponible durante el preflight.', correction:'Verificar el cambio contra la consulta diagnosticada.',
};
const before = host('2026-11-11T17:57:59-03:00');
const after = host('2026-11-11T18:28:00-03:00');
const at = (snapshot: HostSnapshot) => Date.parse(snapshot.observedAt);

test('classifies boundaries and rejects stale, uncertain or wrong zone clocks', () => {
  assert.equal(classify(initial,before,at(before)), 'BEFORE_WINDOW');
  const open = host(initial.opensAt);
  assert.equal(classify(initial,open,at(open)), 'WINDOW_ACTIVE');
  assert.equal(classify(initial,after,at(after)), 'WINDOW_EXPIRED');
  assert.equal(classify(initial,before,at(before)+20_000), 'TIME_UNCERTAIN');
  assert.equal(classify(initial,{ ...before,timeZone:'UTC' },at(before)), 'TIME_UNCERTAIN');
  assert.equal(classify(initial,{ ...before,utcOffsetMinutes:0 },at(before)), 'TIME_UNCERTAIN');
  assert.throws(() => makeWindow('2026-11-31T17:58:00-03:00'), /invalid_montevideo_boundary/);
});

test('reuses a prepared authorization and fails closed on unknown or occupied resources', () => {
  assert.deepEqual(nextWindow([initial],before,retry,at(before)), { kind:'selected',window:initial });
  for (const change of [{ occupied:true },{ probeOk:false },{ task:'enabled' }] as const) {
    assert.deepEqual(nextWindow([initial],{ ...before,...change },retry,at(before)),
      { kind:'blocked', reason:'resource_busy_or_unknown' });
  }
  assert.throws(() => nextWindow([initial,makeWindow('2026-11-11T18:05:00-03:00')],before,retry,at(before)), /overlapping_windows/);
  assert.throws(() => validateWindow({ ...initial,authorization:'PENDING',status:'ACTIVE' }), /invalid_window_authorization_state/);
  assert.throws(() => validateWindow({ ...initial,stopsAt:initial.closesAt }), /invalid_window_schedule/);
});

test('requires new evidence, deduplicates proposals and never authorizes one automatically', () => {
  assert.equal(nextWindow([initial],after,undefined,at(after)).kind, 'blocked');
  const result = nextWindow([initial],after,retry,at(after));
  assert.equal(result.kind,'proposed');
  if (result.kind !== 'proposed') return;
  assert.equal(result.window.opensAt,'2026-11-12T17:58:00-03:00');
  assert.equal(result.window.secondTrigger,'2026-11-12T18:02:00-03:00');
  assert.equal(result.window.stopsAt,'2026-11-12T18:20:00-03:00');
  assert.equal(result.window.authorization,'PENDING');
  assert.equal(result.window.status,'PROPOSED');
  assert.equal(nextWindow([initial,result.window],after,retry,at(after)).kind,'selected');
  const expired = host(result.window.closesAt);
  assert.deepEqual(nextWindow([initial,result.window],expired,retry,at(expired)),
    { kind:'blocked',reason:'retry_evidence_already_used' });
});

test('limits recovery to three proposals and preserves the selected local time of day', () => {
  const template = makeWindow('2026-11-11T10:10:00-03:00');
  const expired = host('2026-11-11T23:55:00-03:00');
  const next = nextWindow([template],expired,retry,at(expired));
  assert.equal(next.kind,'proposed');
  if (next.kind === 'proposed') assert.equal(next.window.opensAt,'2026-11-12T10:10:00-03:00');
  const windows = [11,12,13,14].map(date => makeWindow('2026-11-'+date+'T17:58:00-03:00'));
  const later = host('2026-11-14T18:28:00-03:00');
  assert.deepEqual(nextWindow(windows,later,retry,at(later)),
    { kind:'blocked',reason:'proposal_budget_exhausted' });
});
