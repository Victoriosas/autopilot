import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgentId } from './sixAgentControlPlane';
import type { ExecutorAdapter, ExecutorContext, MissionCheckpoint, MissionLedger, MissionOrchestrator, MissionSpecification } from './executorAdapter';
import { claimPersistedTask, completePersistedTask, failPersistedTask, saveMissionCheckpoint, type ClaimedAgentTask } from './sixAgentPersistence';

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(x => typeof x === 'string' && x.length <= 500);
}
/** Parse the versioned envelope, not instructions or permissions supplied by a task. */
export function missionFromTask(task: ClaimedAgentTask): MissionSpecification {
  const input = task.task_payload;
  const meta = input.__autopilot;
  if (!record(meta) || meta.spec_version !== '1' || !record(meta.checkpoint)
    || !Number.isSafeInteger(meta.checkpoint_version) || Number(meta.checkpoint_version) < 0
    || typeof meta.mission_id !== 'string' || !/^[a-zA-Z0-9:_-]{8,128}$/.test(meta.mission_id)
    || typeof input.goal !== 'string' || !input.goal.trim() || input.goal.length > 1000
    || !Number.isSafeInteger(input.goal_version) || Number(input.goal_version) < 1
    || !Number.isSafeInteger(input.plan_version) || Number(input.plan_version) < 1
    || !strings(input.restrictions) || !strings(input.completion_criteria) || !input.completion_criteria.length
    || !Array.isArray(input.plan) || !input.plan.length || input.plan.length > 12) throw Error('invalid_mission');
  const plan = input.plan.map(step => {
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
  return { missionId: meta.mission_id, goal: input.goal, goalVersion: Number(input.goal_version),
    planVersion: Number(input.plan_version), plan, restrictions: input.restrictions, completionCriteria: input.completion_criteria };
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
      const version = context.checkpointVersion + 1;
      const accepted = await saveMissionCheckpoint(client, claimFor(context), version, operationId, context.executorId, checkpoint);
      if (accepted) { context.checkpointVersion = version; context.checkpoint = structuredClone(checkpoint); }
      return accepted;
    },
    async completeMission(context, evidence) { await completePersistedTask(client, claimFor(context), evidence); },
    async failMission(context, reasonCode) { await failPersistedTask(client, claimFor(context), reasonCode); },
  };
}

export class PersistentMissionOrchestrator implements MissionOrchestrator {
  constructor(readonly ledger: MissionLedger, private readonly deadlineMs = 45000) {
    if (!Number.isInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > 45000) throw Error('invalid_deadline');
  }
  async runMission(executor: ExecutorAdapter, agentId: AgentId, signal?: AbortSignal): Promise<void> {
    signal = signal ? AbortSignal.any([signal, AbortSignal.timeout(this.deadlineMs)]) : AbortSignal.timeout(this.deadlineMs);
    signal?.throwIfAborted();
    const context = await this.ledger.claimMission(agentId);
    signal.throwIfAborted();
    if (!context) return;
    context.executorId = executor.executorId;
    // A crash between the final checkpoint and completion needs no executor action.
    if (context.checkpoint.mission_state === 'ready_to_complete') {
      await this.ledger.completeMission(context, `mission:${context.mission.missionId}:verified`); return;
    }
    for (let count = 0; count <= context.mission.plan.length; count++) {
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
      let aborted = () => {};
      try {
        result = await Promise.race([executor.execute(snapshot, signal), new Promise<never>((_resolve, reject) => {
          aborted = () => reject(signal!.reason);
          signal!.addEventListener('abort', aborted, { once: true });
          if (signal!.aborted) aborted();
        })]);
      }
      catch {
        signal?.throwIfAborted();
        await this.ledger.failMission(context, 'executor_failed');
        throw Error('executor_failed');
      }
      finally { signal.removeEventListener('abort', aborted); }
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
        || checkpoint.test_evidence.length < expected.length) throw Error('invalid_executor_result');
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
