import type { OpportunityCandidate } from './opportunityEngine';
import type { CommercialFacts } from './draftBuilder';

export type VictoriosaFitDecision = 'eligible' | 'review' | 'reject';

export interface VictoriosaFit {
  decision: VictoriosaFitDecision;
  reasons: string[];
  regulatoryReviewRequired: boolean;
  risk: 'low' | 'medium' | 'high';
  segment: string;
}

const hardReject = [
  /\bhalloween\b/i,/\bcostume\b/i,/\bcosplay\b/i,/\bdemon\b/i,/\bhorn(?:s)?\b/i,/\bbird[- ]?beak\b/i,
  /\bvape\b/i,/\bnicotine\b/i,/\bcigarette\b/i,/\bcbd\b/i,/\bthc\b/i,/\bsextoy\b/i,/\bdildo\b/i,
  /\bweapon\b/i,/\bknife\b/i,/\btaser\b/i,/\bfirearm\b/i,/\bammunition\b/i,
  /\bsupplement\b/i,/\bcapsule\b/i,/\btablet\b/i,/\bgummy\b/i,/\bweight loss\b/i,/\bsteroid\b/i,
];

const beautyScope = [
  /\bbeauty\b/i,/\bskincare\b/i,/\bskin care\b/i,/\bfacial\b/i,/\bface\b/i,/\bcosmetic\b/i,
  /\bhair\b/i,/\bheadband\b/i,/\bscrunchie\b/i,/\bcomb\b/i,/\bbrush\b/i,/\bmakeup\b/i,
  /\bmanicure\b/i,/\bnail\b/i,/\bspa\b/i,/\bgua sha\b/i,/\broller\b/i,/\bbody care\b/i,
  /\btoner\b/i,/\bserum\b/i,/\bcream\b/i,/\blotion\b/i,/\bcleanser\b/i,/\bsunscreen\b/i,
];

const regulatedCosmetic = [
  /\btoner\b/i,/\bserum\b/i,/\bcream\b/i,/\blotion\b/i,/\bcleanser\b/i,/\bsunscreen\b/i,
  /\bshampoo\b/i,/\bconditioner\b/i,/\bperfume\b/i,/\bdeodorant\b/i,/\bcosmetic\b/i,
];

const regulatedDevice = [
  /\blaser\b/i,/\bipl\b/i,/\bradiofrequency\b/i,/\bmicrocurrent\b/i,/\bled therapy\b/i,
  /\bmedical\b/i,/\btreatment\b/i,/\btherapeutic\b/i,
];

function haystack(candidate: OpportunityCandidate, facts: CommercialFacts) {
  return [candidate.title, facts.category, facts.description].filter(Boolean).join(' ').slice(0, 5000);
}

export function assessVictoriosaFit(candidate: OpportunityCandidate, facts: CommercialFacts): VictoriosaFit {
  const text = haystack(candidate, facts);
  const rejected = hardReject.filter((pattern) => pattern.test(text));
  if (rejected.length) {
    return {
      decision: 'reject',
      reasons: ['VICTORIOSA_OUT_OF_SCOPE_OR_PROHIBITED'],
      regulatoryReviewRequired: false,
      risk: 'high',
      segment: 'rejected',
    };
  }

  if (!beautyScope.some((pattern) => pattern.test(text))) {
    return {
      decision: 'reject',
      reasons: ['VICTORIOSA_BRAND_SCOPE_MISMATCH'],
      regulatoryReviewRequired: false,
      risk: 'medium',
      segment: 'out_of_scope',
    };
  }

  if (regulatedCosmetic.some((pattern) => pattern.test(text))) {
    return {
      decision: 'review',
      reasons: ['URUGUAY_COSMETIC_REGISTRATION_REVIEW_REQUIRED'],
      regulatoryReviewRequired: true,
      risk: 'medium',
      segment: 'regulated_cosmetic',
    };
  }

  if (regulatedDevice.some((pattern) => pattern.test(text))) {
    return {
      decision: 'review',
      reasons: ['URUGUAY_HEALTH_DEVICE_REVIEW_REQUIRED'],
      regulatoryReviewRequired: true,
      risk: 'high',
      segment: 'regulated_device',
    };
  }

  return {
    decision: 'eligible',
    reasons: ['VICTORIOSA_BRAND_FIT'],
    regulatoryReviewRequired: false,
    risk: 'low',
    segment: /headband|scrunchie|hair|comb|brush/i.test(text) ? 'beauty_accessory' : 'beauty_general',
  };
}
