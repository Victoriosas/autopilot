import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizedObjective, DeterministicSyntheticPlanner, SYNTHETIC_ACCEPTANCE, SYNTHETIC_RESOURCES, SYNTHETIC_RESTRICTIONS, validatePlanProposal,
  type AuthorizedSyntheticObjective, type SyntheticObservation } from './missionPlanner';
import type { ExecutorContext, MissionLedger } from './executorAdapter';
import { SYNTHETIC_GOAL } from './syntheticMissionExecutor';
import { missionFromTask, PersistentMissionOrchestrator } from './missionRuntime';
function context(): ExecutorContext {
  const objective: AuthorizedSyntheticObjective = { version: 1, kind: 'synthetic.ensure_verified_artifact', expected: 'canonical_synthetic_result',
    restrictions: [...SYNTHETIC_RESTRICTIONS], resources: [...SYNTHETIC_RESOURCES], acceptance: [...SYNTHETIC_ACCEPTANCE], limits: { maxReplans: 1, maxSteps: 8 } };
  return { executorId: 'synthetic-unit', checkpointVersion: 0, permissions: ['synthetic_worktree'],
    mission: { missionId: 'synthetic-unit', goal: SYNTHETIC_GOAL, goalVersion: 1, planVersion: 0, plan: [], objective,
      restrictions: objective.restrictions, completionCriteria: objective.acceptance, planHistory: [] },
    checkpoint: { mission_state: 'queued', completed_steps: [], pending_steps: [], results: [], artifacts: [], test_evidence: [] } };
}
const ready: SyntheticObservation = { worktree: 'ready', result: 'valid', test: 'valid' };
test('a structured authorized goal needs no fixture-supplied plan', () => {
  const c = context(); const objective = c.mission.objective;
  const received = missionFromTask({ task_id: c.mission.missionId, claim_token: 'synthetic', task_payload: {
    goal: SYNTHETIC_GOAL, goal_version: 1, mission_schema_version: '1', objective,
    __autopilot: { mission_id: c.mission.missionId, spec_version: '1', checkpoint_version: 0, checkpoint: c.checkpoint },
  } });
  assert.deepEqual(received.plan, []); assert.equal(received.planVersion, 0); assert.deepEqual(received.objective, objective);
});
test('three observed states derive three different prerequisite plans', async () => {
  const planner = new DeterministicSyntheticPlanner();
  for (const [observation, tasks] of [
    [{ worktree: 'missing', result: 'missing', test: 'missing' }, ['synthetic.prepare', 'synthetic.modify', 'synthetic.verify']],
    [{ worktree: 'ready', result: 'missing', test: 'missing' }, ['synthetic.modify', 'synthetic.verify']],
    [ready, ['synthetic.verify']],
  ] as const) {
    const c = context(); const proposal = await planner.propose(c, observation);
    validatePlanProposal(c, proposal, observation);
    assert.deepEqual(proposal.steps.map(s => s.task), tasks);
    assert.equal(proposal.version, 1); assert.equal(proposal.reason, 'initial_state');
  }
});
test('a recovered missing test derives repair while preserving objective and completed steps', async () => {
  const c = context(); const planner = new DeterministicSyntheticPlanner();
  const original = await planner.propose(c, { worktree: 'missing', result: 'missing', test: 'missing' });
  c.mission.planVersion = 1; c.mission.plan = original.steps; c.mission.planHistory = [original];
  c.checkpoint.completed_steps = ['prepare-v1', 'modify-v1'];
  const observation: SyntheticObservation = { worktree: 'ready', result: 'valid', test: 'missing' };
  const adapted = await planner.propose(c, observation); validatePlanProposal(c, adapted, observation);
  assert.deepEqual(adapted.steps.map(s => s.id), ['prepare-v1', 'modify-v1', 'modify-v2', 'verify-v2']);
  assert.deepEqual(adapted.objective, original.objective); assert.equal(adapted.reason, 'artifacts_missing');
});
test('invalid proposal, permission expansion and non-allowlisted action are independent policy denials', async () => {
  const c = context(); const planner = new DeterministicSyntheticPlanner();
  for (const [mutate, code] of [
    [(p: Awaited<ReturnType<typeof planner.propose>>) => { p.steps[0].depends_on = [p.steps[0].id]; }, 'invalid_plan'],
    [(p: Awaited<ReturnType<typeof planner.propose>>) => { p.resources.push('network'); }, 'permission_expansion'],
    [(p: Awaited<ReturnType<typeof planner.propose>>) => { p.steps[0].task = 'shell:arbitrary'; }, 'action_not_allowed'],
  ] as const) {
    const proposal = await planner.propose(c, ready); mutate(proposal);
    assert.throws(() => validatePlanProposal(c, proposal, ready), new RegExp(code));
  }
});
test('no unsupported goal, irrevocable conflict or exhausted replan budget can be accepted', async () => {
  const c = context(); const planner = new DeterministicSyntheticPlanner();
  assert.throws(() => authorizedObjective({ ...(c.mission.objective as object), kind: 'send_email' }), /objective_not_admitted/);
  await assert.rejects(planner.propose(c, { ...ready, result: 'conflict' }), /unrecoverable_state/);
  (c.mission.objective as AuthorizedSyntheticObjective).limits.maxReplans = 0;
  const initial = await planner.propose(c, ready); c.mission.plan = initial.steps; c.mission.planVersion = 1;
  const missing: SyntheticObservation = { ...ready, test: 'missing' };
  const adapted = await planner.propose(c, missing);
  assert.throws(() => validatePlanProposal(c, adapted, missing), /replan_budget_exhausted/);
});
test('a proposal cannot remove completed work or exceed the original step budget', async () => {
  const c = context(); const planner = new DeterministicSyntheticPlanner();
  const original = await planner.propose(c, { worktree: 'missing', result: 'missing', test: 'missing' });
  c.mission.plan = original.steps; c.mission.planVersion = 1; c.checkpoint.completed_steps = ['prepare-v1'];
  const observation: SyntheticObservation = { ...ready, test: 'missing' };
  const adapted = await planner.propose(c, observation); adapted.steps.shift();
  assert.throws(() => validatePlanProposal(c, adapted, observation), /invalid_plan|completed_step_changed/);
  (c.mission.objective as AuthorizedSyntheticObjective).limits.maxSteps = 1;
  assert.throws(() => validatePlanProposal(c, { ...original, objective: c.mission.objective as AuthorizedSyntheticObjective }, ready), /invalid_plan/);
});
test('original authorization cannot be replaced by a larger budget after planning', async () => {
  const c = context(); const planner = new DeterministicSyntheticPlanner();
  (c.mission.objective as AuthorizedSyntheticObjective).limits.maxReplans = 0;
  const initial = await planner.propose(c, ready);
  c.mission.planHistory = [initial]; c.mission.plan = initial.steps; c.mission.planVersion = 1;
  (c.mission.objective as AuthorizedSyntheticObjective).limits.maxReplans = 1;
  const missing: SyntheticObservation = { ...ready, test: 'missing' };
  const proposal = await planner.propose(c, missing);
  assert.throws(() => validatePlanProposal(c, proposal, missing), /authorization_changed/);
});
test('a nonresponsive planner is cancelled before any plan or effect is accepted', async () => {
  const c = context(); const events: string[] = [];
  const ledger: MissionLedger = { claimMission: async () => c, saveCheckpoint: async () => { events.push('checkpoint'); return true; },
    completeMission: async () => { events.push('complete'); }, failMission: async () => { events.push('fail'); },
    savePlan: async () => { events.push('plan'); return true; }, blockMission: async () => { events.push('block'); } };
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    await assert.rejects(new PersistentMissionOrchestrator(ledger, 10, {
      plannerId: 'nonresponsive', propose: async () => new Promise(() => {}),
    }).runMission({ executorId: 'synthetic-unit', observe: async () => ready, execute: async () => { events.push('execute'); throw Error('unused'); } }, 'software'), { name: 'TimeoutError' });
    assert.deepEqual(events, []);
  } finally { clearTimeout(keepAlive); }
});
