export type AutopilotAction =
  | 'read'
  | 'analyze'
  | 'create_candidate'
  | 'publish_product'
  | 'write_code'
  | 'create_branch'
  | 'merge_main'
  | 'deploy_production'
  | 'modify_secrets'
  | 'purchase'
  | 'refund';

export type Actor = 'discovery' | 'pricing' | 'purchasing' | 'opencode' | 'codex' | 'human';

export interface PolicyContext {
  actor: Actor;
  action: AutopilotAction;
  amountUsd?: number;
  risk?: 'low' | 'medium' | 'high' | 'critical';
  targetBranch?: string;
}

export interface PolicyDecision {
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

export function evaluatePolicy(ctx: PolicyContext): PolicyDecision {
  if (ctx.actor === 'human') {
    return { allowed: true, requiresHumanApproval: false, reason: 'Explicit human action.' };
  }

  if (ctx.action === 'modify_secrets') {
    return { allowed: false, requiresHumanApproval: true, reason: 'Agents may never autonomously modify secrets.' };
  }

  if (ctx.action === 'merge_main' || ctx.action === 'deploy_production') {
    return {
      allowed: ctx.actor === 'codex',
      requiresHumanApproval: true,
      reason: 'Main merges and production deploys require Codex governance plus human approval.',
    };
  }

  if (ctx.action === 'refund') {
    return { allowed: false, requiresHumanApproval: true, reason: 'Refunds require explicit human approval.' };
  }

  if (ctx.action === 'purchase') {
    const amount = ctx.amountUsd ?? Number.POSITIVE_INFINITY;
    const limit = Number(process.env.AUTOPILOT_PURCHASE_LIMIT_USD || '0');
    const risk = ctx.risk || 'high';
    const withinLimit = limit > 0 && amount <= limit;
    const acceptableRisk = risk === 'low';
    return {
      allowed: ctx.actor === 'purchasing' && withinLimit && acceptableRisk,
      requiresHumanApproval: !(ctx.actor === 'purchasing' && withinLimit && acceptableRisk),
      reason: withinLimit && acceptableRisk
        ? 'Purchase is within configured autonomous limit and low risk.'
        : 'Purchase exceeds autonomous policy or has insufficient risk assurance.',
    };
  }

  if (ctx.action === 'publish_product') {
    const safe = ctx.risk === 'low';
    return {
      allowed: safe,
      requiresHumanApproval: !safe,
      reason: safe ? 'Low-risk product may be auto-published.' : 'Publication requires human review for non-low risk.',
    };
  }

  if (SAFE_AUTONOMOUS_ACTIONS.has(ctx.action)) {
    return { allowed: true, requiresHumanApproval: false, reason: 'Allowed autonomous action.' };
  }

  return { allowed: false, requiresHumanApproval: true, reason: 'Denied by default.' };
}
