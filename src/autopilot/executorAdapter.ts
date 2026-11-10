import type { AgentId } from './sixAgentControlPlane';

export interface MissionPlanStep {
  id: string;
  depends_on: string[];
  task: string;
}

export interface MissionSpecification {
  missionId: string;
  goal: string;
  goalVersion: number;
  planVersion: number;
  plan: MissionPlanStep[];
  restrictions: string[];
  completionCriteria: string[];
}

export interface MissionStepResult {
  step_id: string;
  status: 'passed' | 'failed' | 'blocked';
  summary: string;
}

export type MissionCheckpointState =
  | 'queued'
  | 'in_progress'
  | 'retry_wait'
  | 'blocked'
  | 'ready_to_complete'
  | 'completed';

export interface PersistedMissionCheckpoint {
  mission_state: MissionCheckpointState;
  current_step_id?: string | null;
  completed_steps: string[];
  pending_steps: string[];
  results: MissionStepResult[];
  artifacts: string[];
  test_evidence: string[];
  worktree?: {
    branch: string;
    sha: string;
  };
  last_error?: string;
}

export interface MissionCheckpoint extends Omit<PersistedMissionCheckpoint, 'mission_state' | 'current_step_id' | 'worktree'> {
  mission_state: 'in_progress' | 'ready_to_complete';
  current_step_id: string | null;
  worktree: {
    branch: string;
    sha: string;
  };
}

export interface ExecutorContext {
  mission: MissionSpecification;
  checkpointVersion: number;
  checkpoint: PersistedMissionCheckpoint;
  executorId: string;
  permissions: readonly string[];
}

export interface ExecutorEvent {
  type: 'progress' | 'artifact' | 'test_result';
  stepId: string;
  summary: string;
  reference?: string;
}

export interface ExecutorResult {
  checkpoint: MissionCheckpoint;
  events: ExecutorEvent[];
  evidence: string[];
}

export interface ExecutorAdapter {
  readonly executorId: string;
  execute(context: ExecutorContext, signal?: AbortSignal): Promise<ExecutorResult>;
}

export interface ModelProvider {
  readonly providerId: string;
  generate(input: string, signal?: AbortSignal): Promise<string>;
}

export interface MissionLedger {
  claimMission(agentId: AgentId): Promise<ExecutorContext | null>;
  saveCheckpoint(
    context: ExecutorContext,
    operationId: string,
    checkpoint: MissionCheckpoint,
  ): Promise<boolean>;
  completeMission(context: ExecutorContext, evidence: string): Promise<void>;
  failMission(context: ExecutorContext, reasonCode: string): Promise<void>;
}

export interface MissionOrchestrator {
  readonly ledger: MissionLedger;
  runMission(executor: ExecutorAdapter, agentId: AgentId, signal?: AbortSignal): Promise<void>;
}
