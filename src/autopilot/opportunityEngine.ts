import { calculatePricingQuote, type PriceProvenance, type PricingInput, type PricingQuote } from './pricingEngine';

export type OpportunityRisk = 'low' | 'medium' | 'high' | 'critical';

export interface OpportunityCandidate {
  id: string;
  title: string;
  source?: string;
  sourceUrl?: string;
  pricing: PricingInput;
  demandScore?: number;
  supplierReliabilityScore?: number;
  logisticsScore?: number;
  competitionScore?: number;
  risk?: OpportunityRisk;
  evidence?: {
    title?: PriceProvenance;
    source?: PriceProvenance;
    demand?: PriceProvenance;
    supplierReliability?: PriceProvenance;
    logistics?: PriceProvenance;
    competition?: PriceProvenance;
  };
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface OpportunityResult {
  candidate: OpportunityCandidate;
  pricing: PricingQuote;
  opportunityScore: number;
  status: 'reject' | 'review' | 'draft_ready';
  reasons: string[];
  warnings: string[];
}

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

function provenanceWeight(value?: PriceProvenance): number {
  if (value === 'verified') return 1;
  if (value === 'observed') return 0.85;
  if (value === 'inferred') return 0.6;
  if (value === 'generated') return 0.3;
  return 0.1;
}

function normalizedMetric(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return clamp(Number(value));
}

function riskPenalty(risk: OpportunityRisk = 'medium'): number {
  if (risk === 'low') return 0;
  if (risk === 'medium') return 10;
  if (risk === 'high') return 25;
  return 50;
}

export function evaluateOpportunity(candidate: OpportunityCandidate): OpportunityResult {
  if (!candidate?.id?.trim()) throw new Error('candidate.id is required');
  if (!candidate?.title?.trim()) throw new Error('candidate.title is required');

  const pricing = calculatePricingQuote(candidate.pricing);
  const reasons: string[] = [];
  const warnings = [...pricing.warnings];

  const demand = normalizedMetric(candidate.demandScore, 50);
  const supplierReliability = normalizedMetric(candidate.supplierReliabilityScore, 50);
  const logistics = normalizedMetric(candidate.logisticsScore, 50);
  const competition = normalizedMetric(candidate.competitionScore, 50);
  const marketAdvantage = 100 - competition;

  const evidence = candidate.evidence || {};
  const evidenceConfidence = Math.round(
    (
      provenanceWeight(evidence.demand) * 0.25 +
      provenanceWeight(evidence.supplierReliability) * 0.3 +
      provenanceWeight(evidence.logistics) * 0.2 +
      provenanceWeight(evidence.competition) * 0.25
    ) * 100
  );

  const commercialScore =
    pricing.revenueScore * 0.4 +
    demand * 0.2 +
    supplierReliability * 0.15 +
    logistics * 0.1 +
    marketAdvantage * 0.1 +
    evidenceConfidence * 0.05 -
    riskPenalty(candidate.risk);

  const opportunityScore = Math.round(clamp(commercialScore));

  const supplierCostProvenance = candidate.pricing.provenance?.supplierCost;
  const costIsTrustworthy = supplierCostProvenance === 'verified' || supplierCostProvenance === 'observed';
  const risk = candidate.risk || 'medium';
  const severeRisk = risk === 'high' || risk === 'critical';

  if (!costIsTrustworthy) {
    warnings.push('Supplier cost lacks verified/observed provenance; candidate cannot become draft_ready.');
  }
  if (severeRisk) warnings.push(`Candidate risk is ${risk}; human review is mandatory.`);
  if (evidenceConfidence < 50) warnings.push('Commercial evidence confidence is low.');
  if (pricing.estimatedNetMarginPct >= 30) reasons.push('Healthy estimated net margin.');
  if (demand >= 70) reasons.push('Strong demand signal.');
  if (supplierReliability >= 75) reasons.push('Supplier reliability signal is strong.');
  if (logistics >= 70) reasons.push('Logistics profile is favorable.');
  if (marketAdvantage >= 60) reasons.push('Competition profile leaves room to differentiate.');

  let status: OpportunityResult['status'] = 'review';
  if (risk === 'critical' || opportunityScore < 45 || pricing.estimatedProfit <= 0) {
    status = 'reject';
  } else if (
    opportunityScore >= 72 &&
    pricing.confidence >= 75 &&
    evidenceConfidence >= 60 &&
    costIsTrustworthy &&
    !severeRisk
  ) {
    status = 'draft_ready';
  }

  return {
    candidate,
    pricing,
    opportunityScore,
    status,
    reasons,
    warnings,
  };
}

export function rankOpportunities(candidates: OpportunityCandidate[], limit = 20): OpportunityResult[] {
  if (!Array.isArray(candidates)) throw new Error('candidates must be an array');
  if (candidates.length > 500) throw new Error('Maximum 500 candidates per evaluation batch');
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));

  return candidates
    .map(evaluateOpportunity)
    .sort((a, b) => {
      const statusWeight = { draft_ready: 3, review: 2, reject: 1 } as const;
      const byStatus = statusWeight[b.status] - statusWeight[a.status];
      if (byStatus !== 0) return byStatus;
      return b.opportunityScore - a.opportunityScore;
    })
    .slice(0, safeLimit);
}
