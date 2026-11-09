import { createHash } from 'node:crypto';
import type { ExecutorContext, MissionPlanStep } from './executorAdapter';

export const SYNTHETIC_RESTRICTIONS = ['local_synthetic_only', 'no_network', 'no_send'];
export const SYNTHETIC_RESOURCES = ['synthetic_worktree', 'result_artifact', 'verification_fixture'];
export const SYNTHETIC_ACCEPTANCE = ['artifact_matches', 'synthetic_test_passed'];
export interface AuthorizedSyntheticObjective {
  version: 1;
  kind: 'synthetic.ensure_verified_artifact';
  expected: 'canonical_synthetic_result';
  restrictions: string[];
  resources: string[];
  acceptance: string[];
  limits: { maxReplans: number; maxSteps: number };
}
export interface SyntheticObservation {
  worktree: 'missing' | 'ready';
  result: 'missing' | 'valid' | 'conflict';
  test: 'missing' | 'valid' | 'conflict';
}
export interface PlanProposal {
  version: number;
  objective: AuthorizedSyntheticObjective;
  steps: MissionPlanStep[];
  resources: string[];
  restrictions: string[];
  reason: 'initial_state' | 'artifacts_missing';
  observation: SyntheticObservation;
  evidence: string;
}
export interface MissionPlanner {
  readonly plannerId: string;
  propose(context: ExecutorContext, observation: SyntheticObservation, signal?: AbortSignal): Promise<PlanProposal>;
}
export class PlanPolicyError extends Error {
  constructor(readonly code: string) { super(code); }
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const reject = (code: string): never => { throw new PlanPolicyError(code); };
export function authorizedObjective(value: unknown): AuthorizedSyntheticObjective {
  const goal = value as AuthorizedSyntheticObjective;
  if (!goal || goal.version !== 1 || goal.kind !== 'synthetic.ensure_verified_artifact'
    || goal.expected !== 'canonical_synthetic_result'
    || !same(goal.restrictions, SYNTHETIC_RESTRICTIONS) || !same(goal.resources, SYNTHETIC_RESOURCES)
    || !same(goal.acceptance, SYNTHETIC_ACCEPTANCE)
    || !Number.isInteger(goal.limits?.maxReplans) || goal.limits.maxReplans < 0 || goal.limits.maxReplans > 2
    || !Number.isInteger(goal.limits?.maxSteps) || goal.limits.maxSteps < 1 || goal.limits.maxSteps > 8
    || Object.keys(goal).sort().join(',') !== 'acceptance,expected,kind,limits,resources,restrictions,version'
    || Object.keys(goal.limits).sort().join(',') !== 'maxReplans,maxSteps') reject('objective_not_admitted');
  return goal;
}
export function observationEvidence(observation: SyntheticObservation): string {
  return createHash('sha256').update(JSON.stringify({ worktree: observation.worktree, result: observation.result, test: observation.test })).digest('hex');
}
export function safeObservation(value: SyntheticObservation): void {
  if (!value || !['missing', 'ready'].includes(value.worktree)
    || !['missing', 'valid', 'conflict'].includes(value.result) || !['missing', 'valid', 'conflict'].includes(value.test)
    || Object.keys(value).sort().join(',') !== 'result,test,worktree') reject('invalid_observation');
  if (value.worktree === 'missing' && (value.result !== 'missing' || value.test !== 'missing')) reject('invalid_observation');
  if (value.result === 'conflict' || value.test === 'conflict') reject('unrecoverable_state');
}
const ACTIONS = ['synthetic.prepare', 'synthetic.modify', 'synthetic.verify'];
/** Independent of the planner's implementation. A proposal never grants capabilities. */
export function validatePlanProposal(context: ExecutorContext, proposal: PlanProposal, observed: SyntheticObservation): void {
  const objective = authorizedObjective(context.mission.objective);
  safeObservation(observed);
  if (!context.permissions.includes('synthetic_worktree')) reject('permission_required');
  if (!same(proposal?.objective, objective) || !same(proposal.resources, objective.resources)
    || !same(proposal.restrictions, objective.restrictions)) reject('permission_expansion');
  if (context.mission.planVersion > objective.limits.maxReplans) reject('replan_budget_exhausted');
  if (context.mission.planHistory?.some(p => !same(p.objective, objective))) reject('authorization_changed');
  if (proposal.version !== context.mission.planVersion + 1 || !same(proposal.observation, observed)
    || proposal.evidence !== observationEvidence(observed)
    || proposal.reason !== (context.mission.planVersion ? 'artifacts_missing' : 'initial_state')) reject('invalid_plan_evidence');
  const plan = proposal.steps;
  if (!Array.isArray(plan) || !plan.length || plan.length > objective.limits.maxSteps) reject('invalid_plan');
  const completed = context.checkpoint.completed_steps;
  const seen = new Set<string>();
  for (const step of plan) {
    if (!ACTIONS.includes(step?.task)) reject('action_not_allowed');
    if (Object.keys(step).sort().join(',') !== 'depends_on,id,task'
      || !/^\w+-v[1-3]$/.test(step.id) || step.id !== `${step.task.split('.')[1]}-v${step.id.split('-v')[1]}`
      || seen.has(step.id) || !Array.isArray(step.depends_on) || new Set(step.depends_on).size !== step.depends_on.length
      || step.depends_on.some(id => !seen.has(id))) reject('invalid_plan');
    seen.add(step.id);
    if (completed.includes(step.id)) {
      if (!same(step, context.mission.plan.find(old => old.id === step.id))) reject('completed_step_changed');
    } else if (!step.id.endsWith(`-v${proposal.version}`)) reject('invalid_plan');
  }
  if (completed.some(id => !seen.has(id)) || !same(plan.slice(0, completed.length).map(s => s.id), completed)) reject('completed_step_changed');
  const pending = plan.filter(step => !completed.includes(step.id));
  if (!pending.length || pending.at(-1)!.task !== 'synthetic.verify'
    || new Set(pending.map(s => s.task)).size !== pending.length) reject('invalid_plan');
  // Pending steps must be a chain; all required preconditions must be covered by that chain.
  const required = observed.worktree === 'missing' ? 'synthetic.prepare' : null;
  if (required && pending[0].task !== required) reject('invalid_plan');
  const modify = pending.find(s => s.task === 'synthetic.modify');
  if ((observed.result !== 'valid' || observed.test !== 'valid') && !modify) reject('invalid_plan');
  for (let i = 0; i < pending.length; i++) {
    const dependency = i ? pending[i - 1].id : completed.at(-1);
    if (!same(pending[i].depends_on, dependency ? [dependency] : [])) reject('invalid_plan');
  }
  const order = pending.map(s => ACTIONS.indexOf(s.task));
  if (order.some((n, i) => i > 0 && n <= order[i - 1])) reject('invalid_plan');
}

/** Domain planner: derives missing prerequisites from observation, not from a fixture-supplied sequence. */
export class DeterministicSyntheticPlanner implements MissionPlanner {
  readonly plannerId = 'synthetic-state-planner-v1';
  async propose(context: ExecutorContext, observation: SyntheticObservation, signal?: AbortSignal): Promise<PlanProposal> {
    signal?.throwIfAborted();
    const objective = authorizedObjective(context.mission.objective);
    safeObservation(observation);
    const version = context.mission.planVersion + 1;
    const steps = context.checkpoint.completed_steps.map(id => structuredClone(context.mission.plan.find(s => s.id === id)!));
    const tasks: string[] = [];
    if (observation.worktree === 'missing') tasks.push('synthetic.prepare');
    if (observation.result !== 'valid' || observation.test !== 'valid') tasks.push('synthetic.modify');
    tasks.push('synthetic.verify');
    for (const task of tasks) steps.push({ id: `${task.split('.')[1]}-v${version}`, task, depends_on: steps.length ? [steps.at(-1)!.id] : [] });
    return { version, objective: structuredClone(objective), steps, resources: [...objective.resources], restrictions: [...objective.restrictions],
      reason: context.mission.planVersion ? 'artifacts_missing' : 'initial_state', observation: structuredClone(observation), evidence: observationEvidence(observation) };
  }
}
