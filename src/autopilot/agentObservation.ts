import { SIX_AGENTS } from './sixAgentControlPlane';

/** Projection of a bounded ledger read, never an executor heartbeat or authority to dispatch. */
export interface AgentTaskObservation {
  id: string;
  agent_id: string;
  status: string;
  attempt_count: number;
  updated_at: string | null;
  lease_until: string | null;
  completed_evidence: string | null;
}

export type AgentObservation = ReturnType<typeof observeAgents>[number];

export function observeAgents(records: readonly AgentTaskObservation[], now: Date) {
  const timestamp = +now;
  if (!Number.isFinite(timestamp)) throw Error('invalid_observation_time');
  const observedTime = (value: string | null) => {
    const time = value ? Date.parse(value) : NaN;
    return Number.isFinite(time) && time <= timestamp ? time : null;
  };
  return SIX_AGENTS.map(agent => {
    const tasks = records.filter(task => task.agent_id === agent.id);
    const activeClaims = tasks.filter(task => task.status === 'running'
      && task.lease_until !== null && Date.parse(task.lease_until) > timestamp
      && observedTime(task.updated_at) !== null);
    const staleClaims = tasks.filter(task => task.status === 'running').length - activeClaims.length;
    const completions = tasks.filter(task => task.status === 'completed');
    const declared = completions.filter(task => typeof task.completed_evidence === 'string'
      && task.completed_evidence.trim().length > 0).length;
    const times = tasks.flatMap(task => {
      const time = observedTime(task.updated_at);
      return time === null ? [] : [time];
    });
    return {
      id: agent.id, configuredState: agent.state, trigger: agent.trigger,
      // Claims establish ledger ownership only; no worker heartbeat is available here.
      runtimeStatus: 'unknown' as const,
      activityStatus: staleClaims > 0 ? 'reconciliation_required' as const
        : activeClaims.length > 0 ? 'claimed' as const : tasks.length > 0 ? 'recorded' as const : 'unobserved' as const,
      lastActivity: times.length ? new Date(Math.max(...times)).toISOString() : null,
      pending: tasks.filter(task => ['queued','failed'].includes(task.status)).length,
      running: activeClaims.length, staleClaims,
      completed: declared, completionUnverified: completions.length,
      completionWithoutEvidence: completions.length - declared,
      blocked: tasks.filter(task => task.status === 'blocked').length,
      measuredCostUsd: null,
    };
  });
}
