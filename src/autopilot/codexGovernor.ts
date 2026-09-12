export type GovernorDecision = 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT';

export interface CodeReviewEvidence {
  branch: string;
  commitSha?: string;
  buildPassed: boolean;
  typecheckPassed: boolean;
  testsPassed: boolean;
  securityPassed: boolean;
  changedFiles: string[];
  touchesSecrets?: boolean;
  touchesPayments?: boolean;
  touchesProductionDeploy?: boolean;
  findings?: string[];
}

export interface GovernorReview {
  decision: GovernorDecision;
  risk: 'low' | 'medium' | 'high' | 'critical';
  mergeAllowed: boolean;
  requiresHumanApproval: boolean;
  reasons: string[];
}

/**
 * Deterministic gate around a Codex review. Codex supplies findings/evidence;
 * this function owns the non-negotiable merge policy.
 */
export function evaluateCodeChange(evidence: CodeReviewEvidence): GovernorReview {
  const reasons = [...(evidence.findings || [])];

  if (evidence.branch === 'main') reasons.push('Agent changes must be developed on a non-main branch.');
  if (evidence.touchesSecrets) reasons.push('Secret changes are forbidden for autonomous agents.');
  if (!evidence.buildPassed) reasons.push('Production build failed.');
  if (!evidence.typecheckPassed) reasons.push('Typecheck failed.');
  if (!evidence.testsPassed) reasons.push('Tests failed.');
  if (!evidence.securityPassed) reasons.push('Security checks failed.');

  const hardFailure =
    evidence.branch === 'main' || evidence.touchesSecrets || !evidence.buildPassed ||
    !evidence.typecheckPassed || !evidence.testsPassed || !evidence.securityPassed;

  const sensitive = Boolean(evidence.touchesPayments || evidence.touchesProductionDeploy);

  if (hardFailure) {
    return {
      decision: evidence.touchesSecrets ? 'REJECT' : 'REQUEST_CHANGES',
      risk: evidence.touchesSecrets ? 'critical' : 'high',
      mergeAllowed: false,
      requiresHumanApproval: true,
      reasons,
    };
  }

  if (sensitive) {
    reasons.push('Sensitive payment/deployment change requires explicit human approval.');
    return { decision: 'APPROVE', risk: 'medium', mergeAllowed: false, requiresHumanApproval: true, reasons };
  }

  return {
    decision: 'APPROVE', risk: 'low', mergeAllowed: true,
    requiresHumanApproval: false, reasons: reasons.length ? reasons : ['All mandatory governance checks passed.'],
  };
}
