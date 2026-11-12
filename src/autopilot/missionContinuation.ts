import type { LocalMissionStatus } from './localMissionStore';

/** Advisory only: SQL claim remains the authority for lease, budget and fencing. */
export function continuationDecision(s: LocalMissionStatus): 'resume' | 'busy' | 'terminal' {
  if (['completed', 'blocked', 'cancelled'].includes(s.state) || ['completed', 'blocked'].includes(s.queueState)) return 'terminal';
  if (!['queued', 'failed', 'running'].includes(s.queueState)
    || !['queued', 'in_progress', 'ready_to_complete'].includes(s.state)
    || !Number.isSafeInteger(s.attempts) || s.attempts < 0
    || !Number.isSafeInteger(s.maxAttempts) || s.maxAttempts < 1) throw Error('invalid_continuation_state');
  if (s.queueState === 'running' && s.leaseActive) return 'busy';
  // An exhausted expired claim must reach SQL so it durably records blocked.
  return 'resume';
}
