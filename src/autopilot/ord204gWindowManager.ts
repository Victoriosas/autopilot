export const windowManager = 'ORD204G_TEST_WINDOW_MANAGER';
export const montevideoZone = 'America/Montevideo';
const minute = 60_000;
const day = 24 * 60 * minute;
const budget = 3;
const datePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/;
export type WindowStatus = 'PROPOSED' | 'AUTHORIZED' | 'PREPARED' | 'ACTIVE' | 'CLOSING' | 'CLOSED' | 'EXPIRED' | 'BLOCKED';
export type TemporalStatus = 'BEFORE_WINDOW' | 'WINDOW_ACTIVE' | 'WINDOW_EXPIRED' | 'TIME_UNCERTAIN';
export type RetryReason = 'expired_without_execution' | 'session_unavailable' | 'first_trigger_missing'
  | 'second_trigger_rejected' | 'correction_ready' | 'evidence_incomplete' | 'closed_before_completion';
export interface RetryEvidence { reason: RetryReason; evidenceSha256: string; finding: string; correction: string }
export interface TestWindow {
  opensAt: string;
  firstTrigger: string;
  secondTrigger: string;
  lastTrigger: string;
  stopsAt: string;
  closesAt: string;
  authorization: 'PENDING' | 'EXPLICIT';
  status: WindowStatus;
  retry?: RetryEvidence;
}
export interface HostSnapshot {
  observedAt: string;
  timeZone: string;
  utcOffsetMinutes: number;
  task: 'absent' | 'disabled' | 'enabled';
  occupied: boolean;
  probeOk: boolean;
}

const retryReasons = new Set([
  'expired_without_execution','session_unavailable','first_trigger_missing','second_trigger_rejected',
  'correction_ready','evidence_incomplete','closed_before_completion',
]);

function localTime(epoch: number) {
  return new Date(epoch - 3 * 60 * minute).toISOString().slice(0, 19) + '-03:00';
}

function epoch(value: string) {
  if (!datePattern.test(value) || !Number.isFinite(Date.parse(value)) || localTime(Date.parse(value)) !== value) {
    throw Error('invalid_montevideo_boundary');
  }
  return Date.parse(value);
}

export function makeWindow(opensAt: string): TestWindow {
  const start = epoch(opensAt);
  return {
    opensAt, firstTrigger: localTime(start + 2 * minute), secondTrigger: localTime(start + 4 * minute),
    lastTrigger: localTime(start + 20 * minute), stopsAt: localTime(start + 22 * minute),
    closesAt: localTime(start + 30 * minute), authorization: 'PENDING', status: 'PROPOSED',
  };
}

export function validateWindow(window: TestWindow) {
  const expected = makeWindow(window.opensAt);
  for (const key of ['firstTrigger','secondTrigger','lastTrigger','stopsAt','closesAt'] as const) {
    if (window[key] !== expected[key]) throw Error('invalid_window_schedule');
  }
  if (!['PENDING', 'EXPLICIT'].includes(window.authorization)
      || !['PROPOSED','AUTHORIZED','PREPARED','ACTIVE','CLOSING','CLOSED','EXPIRED','BLOCKED'].includes(window.status)
      || (window.authorization === 'PENDING' && ['AUTHORIZED','ACTIVE','CLOSING','CLOSED'].includes(window.status))
      || (window.authorization === 'EXPLICIT' && window.status === 'PROPOSED')) {
    throw Error('invalid_window_authorization_state');
  }
  if (window.retry) validateRetry(window.retry);
  return window;
}

function validateRetry(retry: RetryEvidence) {
  if (!retryReasons.has(retry.reason) || !/^[0-9a-f]{64}$/.test(retry.evidenceSha256)
      || [retry.finding, retry.correction].some(value => typeof value !== 'string' || !value.trim() || value.length > 280)) {
    throw Error('invalid_retry_evidence');
  }
}

export function classify(window: TestWindow, host: HostSnapshot, now = Date.now()): TemporalStatus {
  validateWindow(window);
  const time = Date.parse(host.observedAt);
  if (!['Montevideo Standard Time', montevideoZone].includes(host.timeZone)
      || host.utcOffsetMinutes !== -180 || !Number.isFinite(time) || Math.abs(now - time) > 15_000) return 'TIME_UNCERTAIN';
  if (time < epoch(window.opensAt)) return 'BEFORE_WINDOW';
  if (time >= epoch(window.closesAt)) return 'WINDOW_EXPIRED';
  return 'WINDOW_ACTIVE';
}

function overlaps(a: TestWindow, b: TestWindow) {
  return epoch(a.opensAt) < epoch(b.closesAt) && epoch(b.opensAt) < epoch(a.closesAt);
}

export function nextWindow(windows: TestWindow[], host: HostSnapshot, retry?: RetryEvidence, now = Date.now()) {
  if (windows.length === 0 || windows.length > budget + 1) throw Error('invalid_window_inventory');
  const ordered = windows.map(validateWindow).sort((a,b) => epoch(a.opensAt) - epoch(b.opensAt));
  if (ordered.some((window,i) => i > 0 && overlaps(window, ordered[i - 1]))) throw Error('overlapping_windows');
  if (classify(ordered[0], host, now) === 'TIME_UNCERTAIN') return { kind: 'blocked', reason: 'TIME_UNCERTAIN' } as const;
  if (!host.probeOk || host.occupied || host.task === 'enabled'
      || ordered.some(window => ['ACTIVE','CLOSING'].includes(window.status))) {
    return { kind: 'blocked', reason: 'resource_busy_or_unknown' } as const;
  }
  const usable = (window: TestWindow) => epoch(window.firstTrigger) > now
    && ['AUTHORIZED','PROPOSED','PREPARED'].includes(window.status);
  const authorized = ordered.find(window => window.authorization === 'EXPLICIT' && usable(window));
  if (authorized) return { kind: 'selected', window: authorized } as const;
  const pending = ordered.find(usable);
  if (pending) return { kind: 'selected', window: pending } as const;
  if (ordered.length - 1 >= budget) return { kind: 'blocked', reason: 'proposal_budget_exhausted' } as const;
  if (!retry) return { kind: 'blocked', reason: 'retry_evidence_required' } as const;
  validateRetry(retry);
  if (ordered.some(window => window.retry?.evidenceSha256 === retry.evidenceSha256)) {
    return { kind: 'blocked', reason: 'retry_evidence_already_used' } as const;
  }

  // Reuse the operator's time of day, starting on the next Montevideo calendar day.
  const template = epoch(ordered[0].opensAt);
  const midnight = (time: number) => epoch(localTime(time).slice(0,10) + 'T00:00:00-03:00');
  const firstDay = Math.max(1, Math.round((midnight(now) - midnight(template)) / day) + 1);
  for (let offset = firstDay; offset < firstDay + 7; offset++) {
    const candidate = makeWindow(localTime(template + offset * day));
    if (!ordered.some(window => overlaps(candidate, window))) {
      return { kind: 'proposed', window: { ...candidate, retry } } as const;
    }
  }
  return { kind: 'blocked', reason: 'no_free_candidate' } as const;
}
