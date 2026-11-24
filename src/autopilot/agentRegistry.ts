import { AGENT_IDS, type AgentId } from './sixAgentControlPlane';
import type { AutopilotAction } from './policyEngine';

export interface AgentDefinition {
  id: AgentId;
  purpose: string;
  autonomousActions: AutopilotAction[];
  humanGatedActions: AutopilotAction[];
  /** Configuration visibility is not proof of a worker or a running process. */
  runtimeStatus: 'not_proven';
  /** Closed until a separately reviewed runtime and task scope exist. */
  enabled: false;
  /** No agent configuration in this registry may send external communications. */
  noSend: true;
}

type AgentConfig = Omit<AgentDefinition, 'id'>;

const READ_ONLY: AutopilotAction[] = ['read', 'analyze'];
const EFFECTFUL: AutopilotAction[] = [
  'create_candidate', 'publish_product', 'write_code', 'create_branch',
  'merge_main', 'deploy_production', 'modify_secrets', 'purchase', 'refund',
];

const CONFIG: Record<AgentId, AgentConfig> = {
  director: {
    purpose: 'Coordinate and report on approved, read-only work; no dispatch or execution is configured.',
    autonomousActions: [...READ_ONLY],
    humanGatedActions: [...EFFECTFUL],
    runtimeStatus: 'not_proven', enabled: false, noSend: true,
  },
  software: {
    purpose: 'Prepare code changes and reviewable branches; integration and release remain gated.',
    autonomousActions: ['read', 'analyze', 'write_code', 'create_branch'],
    humanGatedActions: ['create_candidate', 'publish_product', 'merge_main', 'deploy_production', 'modify_secrets', 'purchase', 'refund'],
    runtimeStatus: 'not_proven', enabled: false, noSend: true,
  },
  infrastructure: {
    purpose: 'Observe infrastructure health and report; configuration changes and deployment remain gated.',
    autonomousActions: [...READ_ONLY],
    humanGatedActions: [...EFFECTFUL],
    runtimeStatus: 'not_proven', enabled: false, noSend: true,
  },
  consultations: {
    purpose: 'Classify and summarize consultations for human review; never send a reply.',
    autonomousActions: [...READ_ONLY],
    humanGatedActions: [...EFFECTFUL],
    runtimeStatus: 'not_proven', enabled: false, noSend: true,
  },
  followup: {
    purpose: 'Identify authorized follow-up work for review; no customer contact is configured.',
    autonomousActions: [...READ_ONLY],
    humanGatedActions: [...EFFECTFUL],
    runtimeStatus: 'not_proven', enabled: false, noSend: true,
  },
  reports: {
    purpose: 'Prepare aggregate reports without exposing raw evidence or personal data.',
    autonomousActions: [...READ_ONLY],
    humanGatedActions: [...EFFECTFUL],
    runtimeStatus: 'not_proven', enabled: false, noSend: true,
  },
};

export function listAgents(): AgentDefinition[] {
  return AGENT_IDS.map((id) => ({
    id,
    ...CONFIG[id],
    autonomousActions: [...CONFIG[id].autonomousActions],
    humanGatedActions: [...CONFIG[id].humanGatedActions],
  }));
}

export function getAgent(id: string): AgentDefinition | undefined {
  return listAgents().find((agent) => agent.id === id);
}
