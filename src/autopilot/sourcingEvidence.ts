import { createHash } from 'node:crypto';
import type { CJProduct } from '../services/cjDropshipping';
import type { OpportunityCandidate } from './opportunityEngine';
import type { CommercialFacts } from './draftBuilder';

export interface SourcingConfig {
  enabled: boolean; mode: 'shadow' | 'production'; destination: string; currency: string;
  minMargin: number | null; keyword: string; maxCandidates: number; maxAiCalls: number;
  durationMs: number; retries: number; version: string;
}
function integer(value: string | undefined, fallback: number, max: number) {
  return value && /^\d+$/.test(value) && Number(value)>0 ? Math.min(Number(value),max) : fallback;
}
export function sourcingConfig(env: NodeJS.ProcessEnv = process.env): SourcingConfig {
  const margin = Number(env.AUTOPILOT_V4_MIN_MARGIN_PCT);
  return {
    enabled: env.AUTOPILOT_V4_SOURCING_ENABLED === 'true',
    mode: env.AUTOPILOT_SHADOW_MODE === 'false' ? 'production' : 'shadow',
    destination: /^[A-Z]{2}$/.test(env.AUTOPILOT_V4_DESTINATION || '') ? env.AUTOPILOT_V4_DESTINATION! : 'UY',
    currency: /^[A-Z]{3}$/.test(env.STORE_CURRENCY || '') ? env.STORE_CURRENCY! : 'UYU',
    minMargin: env.AUTOPILOT_V4_MIN_MARGIN_PCT && Number.isFinite(margin) && margin>=5 && margin<=75 ? margin : null,
    keyword: (env.AUTOPILOT_V4_KEYWORD || 'facial headband').slice(0,120),
    maxCandidates: integer(env.MAX_CANDIDATES_PER_RUN,10,30),
    maxAiCalls: integer(env.MAX_AI_CALLS_PER_RUN,6,12),
    durationMs: integer(env.MAX_RUN_DURATION_MS,20000,40000), retries: integer(env.MAX_RETRIES_PER_ITEM,3,5),
    version: 'v4-evidence-1',
  };
}
export interface Evidence {
  provider: 'cj'; productId: string; variantId?: string; observedAt: string;
  sourceUrl: string; currency: string | null; stock: number | null;
  supplierCost: number | null; shippingCost: number | null; destination: string;
  shippingVerified: boolean; imageRightsVerified: boolean;
  candidate?: OpportunityCandidate; facts: CommercialFacts;
}
// A search response is an observation, not a landed-cost/variant quote. Only
// an independently verified provider adapter may supply the missing evidence.
export function normalizeCJ(product: CJProduct, config: SourcingConfig): Evidence {
  return {
    provider: 'cj', productId: product.pid, observedAt: new Date().toISOString(),
    sourceUrl: `https://developers.cjdropshipping.com/api2.0/v1/product/query?pid=${encodeURIComponent(product.pid)}`,
    currency: null, supplierCost: null, shippingCost: null,
    stock: product.stockQuantity ?? null, destination: config.destination,
    shippingVerified: false, imageRightsVerified: false,
    facts: { description: (product.productNameEn || '').slice(0,2000), images: product.productImage ? [product.productImage] : [] },
  };
}
export function evidenceIdentity(e: Evidence) { return `cj:${e.productId}:${e.variantId || 'unspecified'}:${e.destination}`; }
export function evidenceVersion(e: Evidence) { return createHash('sha256').update(JSON.stringify(e)).digest('hex'); }
export function validateEvidence(e: Evidence, config: SourcingConfig, now=Date.now()): string[] {
  const missing: string[]=[];
  if (!e.productId || !e.variantId) missing.push('VARIANT_IDENTITY_REQUIRED');
  if (!e.currency || e.currency!==config.currency || e.candidate?.pricing.currency!==e.currency) missing.push('VERIFIED_CURRENCY_OR_FX_REQUIRED');
  if (typeof e.supplierCost!=='number' || !Number.isFinite(e.supplierCost) || e.supplierCost<=0) missing.push('SUPPLIER_COST_REQUIRED');
  if (e.shippingCost===null || !Number.isFinite(e.shippingCost) || e.shippingCost<0 || !e.shippingVerified || e.destination!==config.destination) missing.push('SHIPPING_EVIDENCE_REQUIRED');
  if (e.stock===null || !Number.isSafeInteger(e.stock) || e.stock<0) missing.push('STOCK_EVIDENCE_REQUIRED');
  if (!e.imageRightsVerified) missing.push('IMAGE_RIGHTS_REQUIRED');
  const time=Date.parse(e.observedAt);
  if (!Number.isFinite(time) || now-time>86400000 || time>now+60000) missing.push('FRESH_EVIDENCE_REQUIRED');
  if (!/^https:\/\//.test(e.sourceUrl)) missing.push('SOURCE_REQUIRED');
  if (config.minMargin===null) missing.push('MARGIN_POLICY_REQUIRED');
  const p=e.candidate?.pricing;
  if (!p || p.supplierCost!==e.supplierCost || p.supplierShipping!==e.shippingCost ||
    !['verified','observed'].includes(p.provenance?.supplierCost || '') ||
    !['verified','observed'].includes(p.provenance?.supplierShipping || '')) missing.push('PRICING_EVIDENCE_REQUIRED');
  for (const key of ['customsRatePct','paymentFeePct','paymentFeeFixed','returnReservePct','acquisitionCost','taxRatePct'] as const) {
    const value=p?.[key];
    if (typeof value!=='number' || !Number.isFinite(value) || value<0) missing.push(`COST_COMPONENT_REQUIRED:${key}`);
  }
  for (const key of ['demand','supplierReliability','logistics','competition'] as const) {
    if (!['observed','verified'].includes(e.candidate?.evidence?.[key] || '')) missing.push(`COMMERCIAL_EVIDENCE_REQUIRED:${key}`);
  }
  for (const key of ['demandScore','supplierReliabilityScore','logisticsScore','competitionScore'] as const) {
    const value=e.candidate?.[key];
    if(typeof value!=='number' || !Number.isFinite(value) || value<0 || value>100) missing.push(`OBSERVED_SCORE_REQUIRED:${key}`);
  }
  if(!e.facts.images?.length) missing.push('PRODUCT_IMAGES_REQUIRED');
  return missing;
}
