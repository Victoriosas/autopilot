import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgentId } from './sixAgentControlPlane';
import type { ExecutorAdapter, ExecutorContext, MissionCheckpoint, MissionLedger, MissionOrchestrator, MissionSpecification } from './executorAdapter';
import { claimPersistedTask, completePersistedTask, failPersistedTask, saveMissionCheckpoint, type ClaimedAgentTask } from './sixAgentPersistence';
import { authorizedObjective, PlanPolicyError, safeObservation, validatePlanProposal, type MissionPlanner, type PlanProposal } from './missionPlanner';

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(x => typeof x === 'string' && x.length <= 500);
}
async function bounded<T>(start: () => Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let onAbort = () => {};
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(signal.reason); signal.addEventListener('abort', onAbort, { once: true });
  });
  try { return await Promise.race([start(), aborted]); }
  finally { signal.removeEventListener('abort', onAbort); }
}
/** Parse the versioned envelope, not instructions or permissions supplied by a task. */
export function missionFromTask(task: ClaimedAgentTask): MissionSpecification {
  const input = task.task_payload;
  const meta = input.__autopilot;
  const planned = Object.hasOwn(input, 'objective');
  if (!record(meta) || meta.spec_version !== '1' || !record(meta.checkpoint)
    || !Number.isSafeInteger(meta.checkpoint_version) || Number(meta.checkpoint_version) < 0
    || typeof meta.mission_id !== 'string' || !/^[a-zA-Z0-9:_-]{8,128}$/.test(meta.mission_id)
    || typeof input.goal !== 'string' || !input.goal.trim() || input.goal.length > 1000
    || !Number.isSafeInteger(input.goal_version) || Number(input.goal_version) < 1
    || (!planned && (!Number.isSafeInteger(input.plan_version) || Number(input.plan_version) < 1
      || !strings(input.restrictions) || !strings(input.completion_criteria) || !input.completion_criteria.length
      || !Array.isArray(input.plan) || !input.plan.length || input.plan.length > 12))) throw Error('invalid_mission');
  const sourcePlan = planned && input.plan === undefined ? [] : input.plan;
  if (planned && (!Number.isSafeInteger(input.plan_version ?? 0) || Number(input.plan_version ?? 0) < 0
    || Number(input.plan_version ?? 0) > 3 || !Array.isArray(input.plan_history ?? []))) throw Error('invalid_mission');
  if (!Array.isArray(sourcePlan) || sourcePlan.length > 12) throw Error('invalid_plan');
  const plan = sourcePlan.map(step => {
    if (!record(step) || typeof step.id !== 'string' || !/^[a-zA-Z0-9._:-]{1,80}$/.test(step.id)
      || typeof step.task !== 'string' || !step.task.trim() || step.task.length > 500
      || !strings(step.depends_on)) throw Error('invalid_plan');
    return { id: step.id, task: step.task, depends_on: [...step.depends_on] };
  });
  const remaining = new Map(plan.map(step => [step.id, step]));
  if (remaining.size !== plan.length) throw Error('invalid_plan');
  const resolved = new Set<string>();
  while (remaining.size) {
    const next = [...remaining.values()].find(step => step.depends_on.every(id => resolved.has(id)));
    if (!next) throw Error('invalid_dependencies');
    resolved.add(next.id); remaining.delete(next.id);
  }
  const objective = record(input.objective) ? input.objective : {};
  return { missionId: meta.mission_id, goal: input.goal, goalVersion: Number(input.goal_version),
    planVersion: Number(input.plan_version ?? 0), plan,
    restrictions: (planned ? objective.restrictions ?? [] : input.restrictions) as string[],
    completionCriteria: (planned ? objective.acceptance ?? [] : input.completion_criteria) as string[],
    ...(planned ? { objective: input.objective, planHistory: (input.plan_history ?? []) as PlanProposal[] } : {}) };
}

/** Credentials stay in the host. Adapters receive no client or fencing token. */
export function createMissionLedger(client: SupabaseClient, permissions: readonly string[] = []): MissionLedger {
  const claims = new WeakMap<ExecutorContext, ClaimedAgentTask>();
  const claimFor = (context: ExecutorContext) => {
    const claim = claims.get(context);
    if (!claim) throw Error('unknown_claim');
    return claim;
  };
  return {
    async claimMission(agentId: AgentId) {
      const claim = await claimPersistedTask(client, agentId);
      if (!claim) return null;
      const mission = missionFromTask(claim);
      const meta = claim.task_payload.__autopilot as Record<string, unknown>;
      const context: ExecutorContext = { mission, checkpointVersion: Number(meta.checkpoint_version),
        checkpoint: structuredClone(meta.checkpoint) as ExecutorContext['checkpoint'], executorId: '', permissions: [...permissions] };
      claims.set(context, claim);
      return context;
    },
    async saveCheckpoint(context, operationId, checkpoint) {
      if (context.mission.objective !== undefined) checkpoint = { ...checkpoint, plan_version: context.mission.planVersion };
      const version = context.checkpointVersion + 1;
      const accepted = await saveMissionCheckpoint(client, claimFor(context), version, operationId, context.executorId, checkpoint);
      if (accepted) { context.checkpointVersion = version; context.checkpoint = structuredClone(checkpoint); }
      return accepted;
    },
    async completeMission(context, evidence) { await completePersistedTask(client, claimFor(context), evidence); },
    async failMission(context, reasonCode) { await failPersistedTask(client, claimFor(context), reasonCode); },
    async savePlan(context, proposal, plannerId) {
      const claim = claimFor(context);
      const checkpointVersion = context.checkpointVersion + 1;
      const history = [...(context.mission.planHistory ?? []), structuredClone(proposal)];
      const { data, error } = await client.rpc('six_agent_save_plan', {
        p_task_id: claim.task_id, p_token: claim.claim_token, p_checkpoint_version: checkpointVersion,
        p_operation_id: `plan:${context.mission.missionId}:${proposal.version}`, p_planner_id: plannerId, p_proposal: proposal,
      });
      if (error) throw Error('plan_write_failed');
      if (data !== true) return false;
      context.checkpointVersion = checkpointVersion;
      context.mission.planVersion = proposal.version; context.mission.plan = structuredClone(proposal.steps);
      context.mission.planHistory = history;
      const pending = proposal.steps.filter(s => !context.checkpoint.completed_steps.includes(s.id));
      context.checkpoint = { ...context.checkpoint, mission_state: 'in_progress', plan_version: proposal.version,
        pending_steps: pending.map(s => s.id), current_step_id: pending[0]?.id ?? null };
      return true;
    },
    async blockMission(context, reasonCode) {
      if (!/^[a-z][a-z0-9_]{2,63}$/.test(reasonCode)) throw Error('reason_code_required');
      const claim = claimFor(context);
      const { data, error } = await client.rpc('six_agent_block_mission', {
        p_task_id: claim.task_id, p_token: claim.claim_token, p_checkpoint_version: context.checkpointVersion,
        p_reason: reasonCode,
      });
      if (error || data !== true) throw Error('block_rejected');
      context.checkpoint.mission_state = 'blocked'; context.checkpoint.last_error = reasonCode;
    },
  };
}

export class PersistentMissionOrchestrator implements MissionOrchestrator {
  constructor(readonly ledger: MissionLedger, private readonly deadlineMs = 45000, private readonly planner?: MissionPlanner) {
    if (!Number.isInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > 45000) throw Error('invalid_deadline');
  }
  async runMission(executor: ExecutorAdapter, agentId: AgentId, signal?: AbortSignal): Promise<void> {
    signal = signal ? AbortSignal.any([signal, AbortSignal.timeout(this.deadlineMs)]) : AbortSignal.timeout(this.deadlineMs);
    signal?.throwIfAborted();
    const context = await this.ledger.claimMission(agentId);
    signal.throwIfAborted();
    if (!context) return;
    context.executorId = executor.executorId;
    const planned = context.mission.objective !== undefined;
    const block = async (reason: string) => {
      if (!this.ledger.blockMission) throw Error('planning_ledger_required');
      await this.ledger.blockMission(context, reason);
    };
    const observe = async () => {
      if (!executor.observe) throw new PlanPolicyError('planning_components_required');
      try { return await bounded(() => executor.observe!(structuredClone(context), signal), signal!); }
      catch { signal!.throwIfAborted(); throw new PlanPolicyError('unrecoverable_state'); }
    };
    const derive = async () => {
      if (!this.planner || !executor.observe || !this.ledger.savePlan) throw new PlanPolicyError('planning_components_required');
      const observed = await observe();
      safeObservation(observed);
      let proposal: PlanProposal;
      try { proposal = await bounded(() => this.planner!.propose(structuredClone(context), structuredClone(observed), signal), signal!); }
      catch (error) { signal!.throwIfAborted(); if (error instanceof PlanPolicyError) throw error; throw new PlanPolicyError('planner_failed'); }
      validatePlanProposal(context, proposal, observed);
      signal!.throwIfAborted();
      if (!await this.ledger.savePlan(context, proposal, this.planner.plannerId)) throw Error('plan_rejected');
    };
    let maxSteps = context.mission.plan.length;
    if (planned) {
      try {
        const objective = authorizedObjective(context.mission.objective); maxSteps = objective.limits.maxSteps;
        if (!context.permissions.includes('synthetic_worktree')) throw new PlanPolicyError('permission_required');
        if (context.mission.planHistory?.some(p => JSON.stringify(p.objective) !== JSON.stringify(objective))) throw new PlanPolicyError('authorization_changed');
        if (!this.planner || !executor.observe) throw new PlanPolicyError('planning_components_required');
        if (!context.mission.planVersion) await derive();
        else if (context.mission.planHistory?.length !== context.mission.planVersion
          || JSON.stringify(context.mission.planHistory.at(-1)?.steps) !== JSON.stringify(context.mission.plan)) throw new PlanPolicyError('invalid_plan');
      } catch (error) {
        signal.throwIfAborted();
        if (error instanceof PlanPolicyError) { await block(error.code); return; }
        // Rejected/ambiguous database writes must stop, not be followed by another write.
        throw error;
      }
    }
    // A crash between the final checkpoint and completion needs no executor action.
    if (context.checkpoint.mission_state === 'ready_to_complete') {
      await this.ledger.completeMission(context, `mission:${context.mission.missionId}:verified`); return;
    }
    for (let count = 0; count <= maxSteps + 2; count++) {
      signal?.throwIfAborted();
      const completed = context.checkpoint.completed_steps;
      if (!strings(completed) || new Set(completed).size !== completed.length
        || completed.some(id => !context.mission.plan.some(step => step.id === id))) throw Error('invalid_checkpoint');
      const next = context.mission.plan.find(step => !completed.includes(step.id)
        && step.depends_on.every(id => completed.includes(id)));
      if (!next) throw Error('no_ready_step');
      // Only the host selects steps. An executor cannot mark several steps passed in one call.
      const snapshot = structuredClone(context);
      snapshot.checkpoint.current_step_id = next.id;
      let result;
      try {
        result = await bounded(() => executor.execute(snapshot, signal), signal);
      }
      catch {
        signal?.throwIfAborted();
        if (planned) {
          try {
            const observed = await observe();
            safeObservation(observed);
            if (observed.worktree === 'ready' && observed.result === 'valid' && observed.test === 'valid') {
              await block('unrecoverable_failure'); return;
            }
            if (context.mission.planVersion > authorizedObjective(context.mission.objective).limits.maxReplans) {
              await block('replan_budget_exhausted'); return;
            }
            await derive(); continue;
          } catch (error) {
            signal.throwIfAborted();
            if (error instanceof PlanPolicyError) { await block(error.code); return; }
            throw error;
          }
        }
        await this.ledger.failMission(context, 'executor_failed');
        throw Error('executor_failed');
      }
      const checkpoint: MissionCheckpoint = result.checkpoint;
      const expected = [...completed, next.id];
      const pending = context.mission.plan.filter(step => !expected.includes(step.id));
      const following = pending.find(step => step.depends_on.every(id => expected.includes(id)));
      if (JSON.stringify(checkpoint.completed_steps) !== JSON.stringify(expected)
        || JSON.stringify(checkpoint.pending_steps) !== JSON.stringify(pending.map(step => step.id))
        || checkpoint.current_step_id !== (following?.id ?? null)
        || checkpoint.mission_state !== (pending.length ? 'in_progress' : 'ready_to_complete')
        || checkpoint.results.length !== expected.length
        || !expected.every(id => checkpoint.results.some(r => r.step_id === id && r.status === 'passed'))
        || checkpoint.test_evidence.length < expected.length) {
        if (planned) { await block('invalid_executor_result'); return; }
        throw Error('invalid_executor_result');
      }
      signal?.throwIfAborted();
      const operationId = `checkpoint:${context.mission.missionId}:${context.checkpointVersion + 1}`;
      // Fencing failure must never be converted into a write from the expired executor.
      if (!await this.ledger.saveCheckpoint(context, operationId, checkpoint)) throw Error('checkpoint_rejected');
      if (!pending.length) {
        await this.ledger.completeMission(context, `mission:${context.mission.missionId}:verified`); return;
      }
    }
    throw Error('step_budget_exhausted');
  }
}
