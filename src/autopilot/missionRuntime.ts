import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgentId } from './sixAgentControlPlane';
import type { ExecutorAdapter, ExecutorContext, MissionCheckpoint, MissionEffectRequest, MissionLedger, MissionOrchestrator, MissionSpecification } from './executorAdapter';
import { claimPersistedMissionTask, completePersistedTask, failPersistedTask, saveMissionCheckpoint, type ClaimedAgentTask } from './sixAgentPersistence';
import { authorizedObjective, PlanPolicyError, safeObservation, validatePlanProposal, type MissionPlanner, type PlanProposal } from './missionPlanner';
import { missionId, LocalMissionStore } from './localMissionStore';
import { decidePermanentObjectiveForLocalStore, type SupervisorDecision } from './permanentSupervisor';
import { createAuthorizedMissionLedger, createMissionClaimGuard, createMissionEffectGuard, type MissionClaimAuthorization, type MissionCompletionVerifier, type MissionEffectDecision } from './missionAuthorization';

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
export function createMissionLedger(client: SupabaseClient, permissions: readonly string[] = [], claimLeaseSeconds=60): MissionLedger {
  if(!Number.isInteger(claimLeaseSeconds)||claimLeaseSeconds<5||claimLeaseSeconds>300)throw Error('invalid_lease');
  const claims = new WeakMap<ExecutorContext, ClaimedAgentTask>();
  const claimFor = (context: ExecutorContext) => {
    const claim = claims.get(context);
    if (!claim) throw Error('unknown_claim');
    return claim;
  };
  return {
    async claimMission(agentId: AgentId) {
      const claim = await claimPersistedMissionTask(client, agentId,claimLeaseSeconds);
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
  /** Opt-in host construction only; supervise/CLI/schedulers never invoke this. */
  static async authorizedPermanentMissionClaim(
    store: LocalMissionStore, grant: MissionClaimAuthorization, runId: string,
    executor: ExecutorAdapter,
    verifyAuthorization: (grant: Readonly<MissionClaimAuthorization>) => Promise<boolean>,
  ): Promise<Pick<MissionLedger, 'claimMission' | 'authorizeExecutor'>> {
    if (store.constructor!==LocalMissionStore) throw Error('mission_authorization_scope_mismatch');
    const guard=createMissionClaimGuard(grant,executor,verifyAuthorization);
    await guard.authorizeExecutor(executor);
    // Observation remains a proposal. Only an independent host policy can permit a claim.
    const decision=await this.inspectPermanentMission(store,guard.expected.missionId,guard.expected.binding);
    if (decision?.action!=='blocked' || decision.reason!=='admission_does_not_authorize_dispatch')
      throw Error('mission_not_fresh_for_authorization');
    // A claim grant carries NO execution capability and exposes no write/completion methods.
    // A later P1 increment must independently authorize effects and attest completion.
    const ledger=createMissionLedger(store.client(guard.expected.missionId,runId,guard),[]);
    return {claimMission:agent=>ledger.claimMission(agent),authorizeExecutor:candidate=>guard.authorizeExecutor(candidate)};
  }
  /** Local synthetic-only execution capability; deliberately not connected to CLI or scheduling. */
  static async authorizedPermanentMissionRuntime(
    store: LocalMissionStore, grant: MissionClaimAuthorization, runId: string, executor: ExecutorAdapter,
    verifyAuthorization: (grant: Readonly<MissionClaimAuthorization>) => Promise<boolean>,
    authorizeEffect: (grant: Readonly<MissionClaimAuthorization>, context: Readonly<ExecutorContext>, effect: Readonly<MissionEffectRequest>, signal?: AbortSignal) => Promise<MissionEffectDecision>,
    verifier: MissionCompletionVerifier,
  ): Promise<MissionLedger> {
    if (store.constructor!==LocalMissionStore) throw Error('mission_authorization_scope_mismatch');
    const claimGuard=createMissionClaimGuard(grant,executor,verifyAuthorization);
    await claimGuard.authorizeExecutor(executor);
    await store.assertAuthorization(claimGuard.expected);
    const decision=await this.inspectPermanentMission(store,claimGuard.expected.missionId,claimGuard.expected.binding);
    if(claimGuard.expected.recovery==='ready_to_complete') {
      const state=await store.status(claimGuard.expected.missionId);
      if(decision?.action!=='verify' || state.queueState!=='running' || state.state!=='ready_to_complete'
        || state.leaseActive!==false || state.checkpointVersion!==claimGuard.expected.checkpointVersion || state.planVersion!==claimGuard.expected.planVersion
        || state.attempts>=state.maxAttempts) throw Error('mission_recovery_not_authorized');
    } else if(claimGuard.expected.recovery==='reconcile_effect') {
      const state=await store.status(claimGuard.expected.missionId);
      if(decision?.action!=='inspect' || decision.reason!=='mission_state_unverified'
        || state.queueState!=='running' || state.state!=='in_progress' || state.leaseActive!==false
        || state.checkpointVersion!==2 || state.planVersion!==1 || state.attempts>=state.maxAttempts)
        throw Error('mission_recovery_not_authorized');
    } else if (decision?.action!=='blocked' || decision.reason!=='admission_does_not_authorize_dispatch')
      throw Error('mission_not_fresh_for_authorization');
    const base=createMissionLedger(store.client(claimGuard.expected.missionId,runId,claimGuard),[]);
    const effectGuard=createMissionEffectGuard(claimGuard.expected,executor,async(g,c,effect,signal)=>{
      signal?.throwIfAborted();
      const decision=await authorizeEffect(g,c,effect,signal);
      // Final admission read after the host callback: true cannot override a durable revoke.
      await store.assertAuthorization(claimGuard.expected);
      signal?.throwIfAborted();
      return decision;
    },{verifierId:verifier?.verifierId,
      verify:typeof verifier?.verify==='function' ? context=>verifier.verify(context) : undefined,
      verifyRecovery:typeof verifier?.verifyRecovery==='function' ? async context=>{
      const accepted=await verifier.verifyRecovery!(context);
      // An awaited oracle cannot revive a policy revoked while it was running.
      await store.assertAuthorization(claimGuard.expected);
      return accepted;
    }:undefined});
    return createAuthorizedMissionLedger(base,executor,claimGuard.expected,effectGuard,verifier.verifierId);
  }
  /**
   * Read-only operational observation of a bound synthetic mission.
   * Reuses the LocalMissionStore/CloudMissionStore status query against the same
   * SQL ledger; never claims, checkpoints, resumes or invokes an executor.
   * This inspection cannot grant execution authority or independent evidence.
   */
  static async inspectPermanentMission(
    store: Pick<LocalMissionStore, 'binding' | 'status'>,
    rawId: string,
    expectedBinding: string,
  ): Promise<SupervisorDecision | null> {
    const id = missionId(rawId);
    return decidePermanentObjectiveForLocalStore(
      [{ id: 'permanent-objective', missionId: id, phase: 'F0', priority: 0, enabled: true }],
      store, expectedBinding, 'F0',
    );
  }
  constructor(readonly ledger: MissionLedger, private readonly deadlineMs = 45000, private readonly planner?: MissionPlanner) {
    if (!Number.isInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > 45000) throw Error('invalid_deadline');
  }
  async runMission(executor: ExecutorAdapter, agentId: AgentId, signal?: AbortSignal): Promise<void> {
    signal = signal ? AbortSignal.any([signal, AbortSignal.timeout(this.deadlineMs)]) : AbortSignal.timeout(this.deadlineMs);
    signal?.throwIfAborted();
    if (this.ledger.authorizeExecutor) await bounded(()=>this.ledger.authorizeExecutor!(executor),signal);
    const guarded=this.ledger.authorizeExecutor!==undefined || this.ledger.authorizeEffect!==undefined || this.ledger.attestCompletion!==undefined;
    if (guarded && (!this.ledger.authorizeEffect || !this.ledger.attestCompletion))
      throw Error('mission_effect_authorization_required');
    signal.throwIfAborted();
    // Protected recovery claims may await an independent oracle after SQL claim.
    // Stop waiting on cancellation; an already admitted claim is not rolled back.
    const context = await bounded(() => this.ledger.claimMission(agentId), signal);
    signal.throwIfAborted();
    if (!context) return;
    context.executorId = executor.executorId;
    const planned = context.mission.objective !== undefined;
    const authorizeEffect=async(effect:MissionEffectRequest):Promise<readonly string[]>=>{
      signal!.throwIfAborted();
      if(this.ledger.authorizeEffect) {
        const permissions=await bounded(()=>this.ledger.authorizeEffect!(executor,structuredClone(context),effect,signal!),signal!);
        signal!.throwIfAborted();
        return permissions;
      }
      return [];
    };
    const complete=async()=>{
      let attestation;
      if(guarded){
        await authorizeEffect({kind:'attest_completion',operationId:`runtime:attest:${context.mission.missionId}:${context.checkpointVersion}`});
        attestation=await bounded(()=>this.ledger.attestCompletion!(executor,structuredClone(context)),signal!);
        if(!attestation || typeof attestation!=='object') throw Error('mission_completion_attestation_required');
        await authorizeEffect({kind:'complete_write',operationId:`runtime:complete:${context.mission.missionId}:${context.checkpointVersion}`});
        signal!.throwIfAborted();
      }
      signal!.throwIfAborted();
      await this.ledger.completeMission(context,`mission:${context.mission.missionId}:verified`,attestation,signal);
    };
    const block = async (reason: string) => {
      if (!this.ledger.blockMission) throw Error('planning_ledger_required');
      await this.ledger.blockMission(context, reason);
    };
    const observe = async () => {
      if (!executor.observe) throw new PlanPolicyError('planning_components_required');
      const permissions=await authorizeEffect({kind:'observe_state',operationId:`runtime:observe:${context.mission.missionId}:${context.checkpointVersion}:${context.mission.planVersion}`});
      const snapshot=structuredClone(context);
      if(this.ledger.authorizeEffect) {
        if(!permissions.includes('synthetic_worktree')) throw Error('mission_effect_authorization_required');
        snapshot.permissions=[...permissions];
      }
      try { return {observed:await bounded(() => executor.observe!(structuredClone(snapshot), signal), signal!),snapshot}; }
      catch { signal!.throwIfAborted(); throw new PlanPolicyError('unrecoverable_state'); }
    };
    const derive = async (observation?:Awaited<ReturnType<typeof observe>>) => {
      if (!this.planner || !executor.observe || !this.ledger.savePlan) throw new PlanPolicyError('planning_components_required');
      const {observed,snapshot} = observation ?? await observe();
      safeObservation(observed);
      let proposal: PlanProposal;
      await authorizeEffect({kind:'save_plan',operationId:`runtime:propose:${context.mission.missionId}:${context.mission.planVersion+1}`});
      try { proposal = await bounded(() => this.planner!.propose(structuredClone(snapshot), structuredClone(observed), signal), signal!); }
      catch (error) { signal!.throwIfAborted(); if (error instanceof PlanPolicyError) throw error; throw new PlanPolicyError('planner_failed'); }
      validatePlanProposal(snapshot, proposal, observed);
      signal!.throwIfAborted();
      if (!await this.ledger.savePlan(context, proposal, this.planner.plannerId)) throw Error('plan_rejected');
    };
    let maxSteps = context.mission.plan.length;
    if (planned) {
      try {
        const objective = authorizedObjective(context.mission.objective); maxSteps = objective.limits.maxSteps;
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
      await complete(); return;
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
      let result;
      const reconcile=this.ledger.recovery==='reconcile_effect' && next.task==='synthetic.modify';
      const effectPermissions=await authorizeEffect({kind:reconcile?'reconcile_effect':'execute_step',operationId:`runtime:${reconcile?'reconcile':'execute'}:${context.mission.missionId}:${context.checkpointVersion}:${next.id}`,stepId:next.id});
      const stepPermission=this.ledger.authorizeEffect ? effectPermissions.includes('synthetic_worktree')
        : context.permissions.includes('synthetic_worktree');
      if(planned && !stepPermission) throw Error('mission_effect_authorization_required');
      const snapshot = structuredClone(context);
      snapshot.checkpoint.current_step_id = next.id;
      snapshot.permissions=this.ledger.authorizeEffect ? [...effectPermissions] : [...context.permissions];
      try {
        if(reconcile && !executor.reconcile)throw Error('reconciliation_adapter_required');
        result = await bounded(() => reconcile ? executor.reconcile!(snapshot,signal) : executor.execute(snapshot, signal), signal);
      }
      catch {
        signal?.throwIfAborted();
        // A failed read-only reconciliation is uncertain evidence, not permission
        // to observe/replan or retry the original write-capable modify step.
        if(reconcile)throw Error('mission_recovery_unverified');
        if (planned) {
          try {
            const observation = await observe();
            const {observed} = observation;
            safeObservation(observed);
            if (observed.worktree === 'ready' && observed.result === 'valid' && observed.test === 'valid') {
              await block('unrecoverable_failure'); return;
            }
            if (context.mission.planVersion > authorizedObjective(context.mission.objective).limits.maxReplans) {
              await block('replan_budget_exhausted'); return;
            }
            await derive(observation); continue;
          } catch (error) {
            signal.throwIfAborted();
            if (error instanceof PlanPolicyError) { await block(error.code); return; }
            throw error;
          }
        }
        await authorizeEffect({kind:'fail',operationId:`runtime:fail:${context.mission.missionId}:${context.checkpointVersion}:executor_failed`});
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
      await authorizeEffect({kind:'write_checkpoint',operationId:`runtime:${operationId}`});
      if (!await this.ledger.saveCheckpoint(context, operationId, checkpoint)) throw Error('checkpoint_rejected');
      if (!pending.length) {
        await complete(); return;
      }
    }
    throw Error('step_budget_exhausted');
  }
}
