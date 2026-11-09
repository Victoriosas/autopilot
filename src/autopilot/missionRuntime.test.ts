import test from 'node:test';
import assert from 'node:assert/strict';
import { missionFromTask, PersistentMissionOrchestrator } from './missionRuntime';
import { SyntheticMissionExecutor, SYNTHETIC_GOAL, SYNTHETIC_PLAN } from './syntheticMissionExecutor';
import type { ExecutorContext, MissionLedger } from './executorAdapter';

function context(): ExecutorContext {
  return { mission: { missionId: 'synthetic-unit', goal: SYNTHETIC_GOAL, goalVersion: 1, planVersion: 1,
    plan: structuredClone(SYNTHETIC_PLAN), restrictions: ['local_synthetic_only', 'no_network', 'no_send'], completionCriteria: ['synthetic_test_passed'] },
    checkpointVersion: 0, executorId: 'synthetic-unit', permissions: ['synthetic_worktree'],
    checkpoint: { mission_state: 'queued', completed_steps: [], pending_steps: [], results: [], artifacts: [], test_evidence: [] } };
}
test('mission envelope rejects cyclic, unknown and duplicate dependencies before execution', () => {
  for (const plan of [
    [{ id: 'a', task: 'synthetic.prepare', depends_on: ['a'] }],
    [{ id: 'a', task: 'synthetic.prepare', depends_on: ['missing'] }],
    [{ id: 'a', task: 'synthetic.prepare', depends_on: [] }, { id: 'a', task: 'synthetic.prepare', depends_on: [] }],
  ]) {
    assert.throws(() => missionFromTask({ task_id: 'synthetic-unit', claim_token: 'fake', task_payload: {
      goal: SYNTHETIC_GOAL, goal_version: 1, plan_version: 1, restrictions: [], completion_criteria: ['passed'], plan,
      __autopilot: { spec_version: '1', mission_id: 'synthetic-unit', checkpoint_version: 0, checkpoint: {} },
    } }), /invalid/);
  }
});
test('synthetic runner denies missing host permission, goal changes and path traversal before filesystem access', async () => {
  const executor = new SyntheticMissionExecutor('unit', 'unreachable', 'unreachable', 'a'.repeat(40));
  for (const mutate of [
    (c: ExecutorContext) => { c.permissions = []; },
    (c: ExecutorContext) => { c.mission.goal = 'send a message'; },
    (c: ExecutorContext) => { c.mission.missionId = 'synthetic-../../escape'; },
    (c: ExecutorContext) => { c.mission.plan[0].task = 'shell:arbitrary'; },
  ]) {
    const candidate = context(); mutate(candidate);
    await assert.rejects(executor.execute(candidate), /synthetic_authorization_required/);
  }
});
function ledgerFor(candidate: ExecutorContext) {
  const events: string[] = [];
  const ledger: MissionLedger = {
    claimMission: async () => candidate,
    saveCheckpoint: async () => { events.push('save'); return true; },
    completeMission: async () => { events.push('complete'); },
    failMission: async (_context, code) => { events.push(code); },
  };
  return { ledger, events };
}
test('an executor cannot bypass steps or failed evidence to complete the mission', async () => {
  const candidate = context(); const { ledger, events } = ledgerFor(candidate);
  const invalid = { mission_state: 'ready_to_complete' as const, current_step_id: null,
    completed_steps: ['prepare', 'modify', 'verify'], pending_steps: [], results: [], artifacts: [], test_evidence: [], worktree: { branch: 'fake', sha: 'fake' } };
  await assert.rejects(new PersistentMissionOrchestrator(ledger).runMission({ executorId: 'invalid', execute: async () => ({ checkpoint: invalid, events: [], evidence: [] }) }, 'software'), /invalid_executor_result/);
  assert.deepEqual(events, []);
});
test('checkpoint refusal stops execution and never attempts a stale completion', async () => {
  const candidate = context(); const { ledger, events } = ledgerFor(candidate);
  ledger.saveCheckpoint = async () => { events.push('rejected'); return false; };
  const checkpoint = { mission_state: 'in_progress' as const, current_step_id: 'modify', completed_steps: ['prepare'], pending_steps: ['modify', 'verify'],
    results: [{ step_id: 'prepare', status: 'passed' as const, summary: 'verified' }], artifacts: [], test_evidence: ['prepare:verified'], worktree: { branch: 'synthetic', sha: 'a'.repeat(40) } };
  await assert.rejects(new PersistentMissionOrchestrator(ledger).runMission({ executorId: 'stale', execute: async () => ({ checkpoint, events: [], evidence: [] }) }, 'software'), /checkpoint_rejected/);
  assert.deepEqual(events, ['rejected']);
});
test('executor failure records only a reason code and does not complete', async () => {
  const { ledger, events } = ledgerFor(context());
  await assert.rejects(new PersistentMissionOrchestrator(ledger).runMission({ executorId: 'failing', execute: async () => { throw Error('untrusted detailed error'); } }, 'software'), /executor_failed/);
  assert.deepEqual(events, ['executor_failed']);
});
test('recovery after ready checkpoint completes without invoking the executor again', async () => {
  const candidate = context(); candidate.checkpoint.mission_state = 'ready_to_complete';
  candidate.checkpoint.completed_steps = ['prepare', 'modify', 'verify'];
  const { ledger, events } = ledgerFor(candidate);
  await new PersistentMissionOrchestrator(ledger).runMission({ executorId: 'replacement', execute: async () => { throw Error('must not execute'); } }, 'software');
  assert.deepEqual(events, ['complete']);
});
test('abort stops the host before any task claim', async () => {
  const { ledger, events } = ledgerFor(context());
  ledger.claimMission = async () => { events.push('claim'); return null; };
  const controller = new AbortController(); controller.abort();
  await assert.rejects(new PersistentMissionOrchestrator(ledger).runMission({ executorId: 'unused', execute: async () => { throw Error('unused'); } }, 'software', controller.signal));
  assert.deepEqual(events, []);
});
test('deadline stops a nonresponsive adapter without accepting subsequent writes', async () => {
  const { ledger, events } = ledgerFor(context());
  // An independent timer keeps the test event loop alive; the runtime deadline is unref'ed by Node.
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    await assert.rejects(new PersistentMissionOrchestrator(ledger, 10).runMission({
      executorId: 'nonresponsive', execute: async () => new Promise(() => {}),
    }, 'software'), { name: 'TimeoutError' });
    assert.deepEqual(events, []);
  } finally { clearTimeout(keepAlive); }
});
