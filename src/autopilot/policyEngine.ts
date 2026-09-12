export const AUTOPILOT_ACTIONS = [
  'read',
  'analyze',
  'create_candidate',
  'publish_product',
  'write_code',
  'create_branch',
  'merge_main',
  'deploy_production',
  'modify_secrets',
  'purchase',
  'refund',
] as const;

export type AutopilotAction = (typeof AUTOPILOT_ACTIONS)[number];

export const ACTORS = ['discovery', 'pricing', 'purchasing', 'opencode', 'codex', 'human'] as const;
export type Actor = (typeof ACTORS)[number];

export const RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export interface PolicyContext {
  actor: Actor;
  action: AutopilotAction;
  amountUsd?: number;
  risk?: RiskLevel;
  targetBranch?: string;
}

export type PolicyDisposition = 'allow' | 'human_gate' | 'deny';

export interface PolicyDecision {
  disposition: PolicyDisposition;
  allowed: boolean;
  requiresHumanApproval: boolean;
  reason: string;
}

const SAFE_AUTONOMOUS_ACTIONS = new Set<AutopilotAction>([
  'read',
  'analyze',
  'create_candidate',
  'write_code',
  'create_branch',
]);

export function isActor(value: unknown): value is Actor {
  return typeof value === 'string' && (ACTORS as readonly string[]).includes(value);
}

export function isAutopilotAction(value: unknown): value is AutopilotAction {
  return typeof value === 'string' && (AUTOPILOT_ACTIONS as readonly string[]).includes(value);
}

export function isRiskLevel(value: unknown): value is RiskLevel {
  return typeof value === 'string' && (RISK_LEVELS as readonly string[]).includes(value);
}

function allow(reason: string): PolicyDecision {
  return { disposition: 'allow', allowed: true, requiresHumanApproval: false, reason };
}

function humanGate(reason: string): PolicyDecision {
  return { disposition: 'human_gate', allowed: false, requiresHumanApproval: true, reason };
}

function deny(reason: string): PolicyDecision {
  return { disposition: 'deny', allowed: false, requiresHumanApproval: false, reason };
}

export function evaluatePolicy(ctx: PolicyContext): PolicyDecision {
  if (ctx.actor === 'human') {
    return allow('Explicit human action.');
  }

  if (ctx.action === 'modify_secrets') {
    return deny('Agents may never modify secrets.');
  }

  if (ctx.action === 'merge_main' || ctx.action === 'deploy_production') {
    return ctx.actor === 'codex'
      ? humanGate('Main merges and production deploys require Codex governance plus human approval.')
      : deny('Only Codex may request main merges or production deploys.');
  }

  if (ctx.action === 'refund') {
    return humanGate('Refunds require explicit human approval.');
  }

  if (ctx.action === 'purchase') {
    if (ctx.actor !== 'purchasing') {
      return deny('Only the purchasing agent may request purchases.');
    }

    const amount = ctx.amountUsd ?? Number.POSITIVE_INFINITY;
    const limit = Number(process.env.AUTOPILOT_PURCHASE_LIMIT_USD || '0');
    const risk = ctx.risk || 'high';
    const withinLimit = Number.isFinite(amount) && amount >= 0 && limit > 0 && amount <= limit;
    const acceptableRisk = risk === 'low';

    return withinLimit && acceptableRisk
      ? allow('Purchase is within configured autonomous limit and low risk.')
      : humanGate('Purchase exceeds autonomous policy or has insufficient trusted risk assurance.');
  }

  if (ctx.action === 'publish_product') {
    const safe = ctx.risk === 'low';
    return safe
      ? allow('Low-risk product may be auto-published.')
      : humanGate('Publication requires human review for non-low or untrusted risk.');
  }

  if (SAFE_AUTONOMOUS_ACTIONS.has(ctx.action)) {
    return allow('Allowed autonomous action.');
  }

  return deny('Denied by default.');
}
