export type VentureVertical = 'beauty_accessories' | 'home_organization' | 'pet_accessories';

export interface VentureSignal {
  vertical: VentureVertical;
  query: string;
  marketPriceUyu: number | null;
  landedCostUyu: number | null;
  netMarginPct: number | null;
  demandScore: number | null;
  competitionScore: number | null;
  shippingSharePct: number | null;
  returnRisk: 'low' | 'medium' | 'high';
  regulatoryRisk: 'low' | 'medium' | 'high';
  sourceCount: number;
  observedAt: string;
}

export interface VentureAssessment {
  vertical: VentureVertical;
  query: string;
  score: number;
  decision: 'promising' | 'watch' | 'reject';
  reasons: string[];
}

const RETURN_PENALTY = { low: 0, medium: 10, high: 25 } as const;
const REGULATORY_PENALTY = { low: 0, medium: 15, high: 35 } as const;

function bounded(value: number | null, fallback: number, min = 0, max = 100) {
  if (value === null || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/**
 * Owner-side venture scoring only. This function never publishes, orders,
 * creates supplier actions or changes Victoriosa catalog state.
 *
 * Missing economics are intentionally punished rather than guessed.
 */
export function assessVenture(signal: VentureSignal): VentureAssessment {
  const reasons: string[] = [];
  if (signal.sourceCount < 2) reasons.push('INSUFFICIENT_MARKET_SOURCES');
  if (signal.marketPriceUyu === null) reasons.push('MARKET_PRICE_UNKNOWN');
  if (signal.landedCostUyu === null) reasons.push('LANDED_COST_UNKNOWN');
  if (signal.netMarginPct === null) reasons.push('NET_MARGIN_UNKNOWN');
  if (signal.demandScore === null) reasons.push('DEMAND_UNKNOWN');

  const evidenceReady = signal.sourceCount >= 2
    && signal.marketPriceUyu !== null
    && signal.landedCostUyu !== null
    && signal.netMarginPct !== null
    && signal.demandScore !== null;

  if (!evidenceReady) {
    return { vertical: signal.vertical, query: signal.query, score: 0, decision: 'watch', reasons };
  }

  const margin = bounded(signal.netMarginPct, 0, 0, 60);
  const demand = bounded(signal.demandScore, 0);
  const competition = bounded(signal.competitionScore, 50);
  const shippingShare = bounded(signal.shippingSharePct, 100);

  // Margin and demand dominate. High competition, freight burden, returns and
  // regulation subtract from the score. No missing value is treated as good.
  let score = (margin / 60) * 40
    + (demand / 100) * 30
    + ((100 - competition) / 100) * 10
    + ((100 - shippingShare) / 100) * 20
    - RETURN_PENALTY[signal.returnRisk]
    - REGULATORY_PENALTY[signal.regulatoryRisk];

  score = Math.round(Math.min(100, Math.max(0, score)));

  if (margin < 25) reasons.push('MARGIN_BELOW_25_PCT');
  if (demand < 45) reasons.push('WEAK_DEMAND_SIGNAL');
  if (shippingShare > 45) reasons.push('FREIGHT_TOO_HEAVY');
  if (competition > 80) reasons.push('VERY_HIGH_COMPETITION');
  if (signal.returnRisk !== 'low') reasons.push(`RETURN_RISK_${signal.returnRisk.toUpperCase()}`);
  if (signal.regulatoryRisk !== 'low') reasons.push(`REGULATORY_RISK_${signal.regulatoryRisk.toUpperCase()}`);

  const hardReject = margin < 20 || signal.regulatoryRisk === 'high' || shippingShare > 70;
  const decision: VentureAssessment['decision'] = hardReject ? 'reject' : score >= 55 ? 'promising' : 'watch';

  if (decision === 'promising') reasons.push('VENTURE_ECONOMICS_AND_DEMAND_PROMISING');
  if (decision === 'reject') reasons.push('VENTURE_FAILS_OWNER_GUARDRAILS');

  return { vertical: signal.vertical, query: signal.query, score, decision, reasons };
}

export const VENTURE_LAB_QUERIES: Record<VentureVertical, string[]> = {
  beauty_accessories: [
    'facial headband',
    'reusable makeup remover pad',
    'makeup brush cleaner',
  ],
  home_organization: [
    'under sink organizer',
    'drawer organizer',
    'shower organizer adhesive',
  ],
  pet_accessories: [
    'pet water fountain',
    'dog car seat cover',
    'anti pull dog harness',
  ],
};
