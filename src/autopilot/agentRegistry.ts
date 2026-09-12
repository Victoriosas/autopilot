import type { Actor, AutopilotAction } from './policyEngine';

export interface AgentDefinition {
  id: string;
  actor: Actor;
  purpose: string;
  autonomousActions: AutopilotAction[];
  humanGatedActions: AutopilotAction[];
  enabled: boolean;
}

const AGENTS: AgentDefinition[] = [
  {
    id: 'discovery-agent',
    actor: 'discovery',
    purpose: 'Find, normalize, and rank product candidates.',
    autonomousActions: ['read', 'analyze', 'create_candidate'],
    humanGatedActions: ['publish_product'],
    enabled: true,
  },
  {
    id: 'pricing-agent',
    actor: 'pricing',
    purpose: 'Analyze pricing, margin, and catalog economics without charging customers.',
    autonomousActions: ['read', 'analyze'],
    humanGatedActions: ['publish_product'],
    enabled: true,
  },
  {
    id: 'purchasing-agent',
    actor: 'purchasing',
    purpose: 'Prepare supplier purchasing actions subject to monetary and risk policy.',
    autonomousActions: ['read', 'analyze'],
    humanGatedActions: ['purchase', 'refund'],
    enabled: false,
  },
  {
    id: 'opencode-worker',
    actor: 'opencode',
    purpose: 'Implement code changes only on agent branches and produce reviewable pull requests.',
    autonomousActions: ['read', 'analyze', 'write_code', 'create_branch'],
    humanGatedActions: ['merge_main', 'deploy_production', 'modify_secrets'],
    enabled: true,
  },
  {
    id: 'codex-governor',
    actor: 'codex',
    purpose: 'Review code and governance decisions before protected actions proceed.',
    autonomousActions: ['read', 'analyze'],
    humanGatedActions: ['merge_main', 'deploy_production', 'modify_secrets'],
    enabled: true,
  },
];

export function listAgents(): AgentDefinition[] {
  return AGENTS.map((agent) => ({ ...agent, autonomousActions: [...agent.autonomousActions], humanGatedActions: [...agent.humanGatedActions] }));
}

export function getAgent(id: string): AgentDefinition | undefined {
  return listAgents().find((agent) => agent.id === id);
}
