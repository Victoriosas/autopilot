import { createHash } from 'node:crypto';
import type { CJFreightOption, CJProduct, CJVariant, CJVariantStock } from '../services/cjDropshipping';
import type { OpportunityCandidate } from './opportunityEngine';
import type { CommercialFacts } from './draftBuilder';

export interface SourcingConfig {
  enabled: boolean;
  mode: 'shadow' | 'production';
  destination: string;
  currency: string;
  minMargin: number | null;
  keyword: string;
  maxCandidates: number;
  maxAiCalls: number;
  durationMs: number;
  retries: number;
  version: string;
  providerCurrency: string;
  providerToStoreRate: number | null;
  customsRatePct: number | null;
  paymentFeePct: number | null;
  paymentFeeFixed: number | null;
  returnReservePct: number | null;
  acquisitionCost: number | null;
  taxRatePct: number | null;
  imageSaleUseAllowed: boolean;
  commercialProxiesAllowed: boolean;
}

function integer(value: string | undefined, fallback: number, max: number) {
  return value && /^\d+$/.test(value) && Number(value) > 0 ? Math.min(Number(value), max) : fallback;
}

function finitePolicy(value: string | undefined, min = 0, max = Number.MAX_SAFE_INTEGER): number | null {
  if (value === undefined || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export function sourcingConfig(env: NodeJS.ProcessEnv = process.env): SourcingConfig {
  const margin = Number(env.AUTOPILOT_V4_MIN_MARGIN_PCT);
  const storeCurrency = /^[A-Z]{3}$/.test(env.STORE_CURRENCY || '') ? env.STORE_CURRENCY! : 'UYU';
  const providerCurrency = /^[A-Z]{3}$/.test(env.AUTOPILOT_CJ_CURRENCY || '') ? env.AUTOPILOT_CJ_CURRENCY! : 'USD';
  const rawRate = finitePolicy(env.AUTOPILOT_CJ_TO_STORE_RATE, 0.000001);
  const mode: 'shadow' | 'production' = env.AUTOPILOT_SHADOW_MODE === 'false' ? 'production' : 'shadow';
  return {
    enabled: env.AUTOPILOT_V4_SOURCING_ENABLED === 'true',
    mode,
    destination: /^[A-Z]{2}$/.test(env.AUTOPILOT_V4_DESTINATION || '') ? env.AUTOPILOT_V4_DESTINATION! : 'UY',
    currency: storeCurrency,
    providerCurrency,
    providerToStoreRate: providerCurrency === storeCurrency ? 1 : rawRate,
    minMargin: env.AUTOPILOT_V4_MIN_MARGIN_PCT && Number.isFinite(margin) && margin >= 5 && margin <= 75 ? margin : null,
    keyword: (env.AUTOPILOT_V4_KEYWORD || 'facial headband').slice(0, 120),
    maxCandidates: integer(env.MAX_CANDIDATES_PER_RUN, 10, 30),
    maxAiCalls: integer(env.MAX_AI_CALLS_PER_RUN, 6, 12),
    durationMs: integer(env.MAX_RUN_DURATION_MS, 20000, 40000),
    retries: integer(env.MAX_RETRIES_PER_ITEM, 3, 5),
    version: 'v4-evidence-3',
    customsRatePct: finitePolicy(env.AUTOPILOT_CUSTOMS_RATE_PCT, 0, 100),
    paymentFeePct: finitePolicy(env.AUTOPILOT_PAYMENT_FEE_PCT, 0, 100),
    paymentFeeFixed: finitePolicy(env.AUTOPILOT_PAYMENT_FEE_FIXED, 0),
    returnReservePct: finitePolicy(env.AUTOPILOT_RETURN_RESERVE_PCT, 0, 100),
    acquisitionCost: finitePolicy(env.AUTOPILOT_ACQUISITION_COST, 0),
    taxRatePct: finitePolicy(env.AUTOPILOT_TAX_RATE_PCT, 0, 100),
    imageSaleUseAllowed: env.AUTOPILOT_CJ_IMAGE_SALE_USE_ALLOWED === 'true',
    // CJ listing/adoption signals are useful for exercising the full decision
    // pipeline, but they are proxies rather than audited market research. They
    // are therefore opt-in and structurally forbidden in production mode.
    commercialProxiesAllowed: mode === 'shadow' && env.AUTOPILOT_CJ_SHADOW_COMMERCIAL_PROXIES === 'true',
  };
}

export interface Evidence {
  provider: 'cj';
  productId: string;
  variantId?: string;
  observedAt: string;
  sourceUrl: string;
  currency: string | null;
  providerCurrency?: string | null;
  fxRate?: number | null;
  stock: number | null;
  supplierCost: number | null;
  shippingCost: number | null;
  destination: string;
  shippingVerified: boolean;
  imageRightsVerified: boolean;
  evidenceNotes?: string[];
  candidate?: OpportunityCandidate;
  facts: CommercialFacts;
}

export function normalizeCJ(product: CJProduct, config: SourcingConfig): Evidence {
  return {
    provider: 'cj',
    productId: product.pid,
    observedAt: new Date().toISOString(),
    sourceUrl: `https://developers.cjdropshipping.com/api2.0/v1/product/query?pid=${encodeURIComponent(product.pid)}`,
    currency: null,
    providerCurrency: config.providerCurrency,
    fxRate: config.providerToStoreRate,
    supplierCost: null,
    shippingCost: null,
    stock: product.stockQuantity ?? null,
    destination: config.destination,
    shippingVerified: false,
    imageRightsVerified: false,
    evidenceNotes: ['SEARCH_OBSERVATION_ONLY'],
    facts: {
      category: product.categoryName || undefined,
      description: (product.description || product.productNameEn || '').slice(0, 2000),
      images: product.productImage ? [product.productImage] : [],
      supplierName: product.supplierName || undefined,
      sourceUrl: product.productUrl,
    },
  };
}

function clampScore(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function parseAgingDays(value: string): number | null {
  const numbers = value.match(/\d+/g)?.map(Number).filter(Number.isFinite) || [];
  return numbers.length ? Math.max(...numbers) : null;
}

function logisticsScore(freight: CJFreightOption): number {
  const days = parseAgingDays(freight.logisticAging);
  if (days === null) return 55;
  if (days <= 10) return 85;
  if (days <= 15) return 75;
  if (days <= 25) return 60;
  if (days <= 40) return 45;
  return 30;
}

function listingSignals(product: CJProduct, now: number) {
  if (typeof product.listedNum !== 'number' || !Number.isFinite(product.listedNum) || product.listedNum < 0 || !product.createTime) {
    return { demandScore: null, competitionScore: null, ageDays: null, listingsPerDay: null };
  }
  const ageDays = Math.max(1, Math.floor((now - Number(product.createTime)) / 86400000));
  if (!Number.isFinite(ageDays) || ageDays < 1) return { demandScore: null, competitionScore: null, ageDays: null, listingsPerDay: null };
  const listingsPerDay = product.listedNum / ageDays;
  // Demand proxy = adoption velocity on CJ. Competition proxy = total number of
  // listings. Neither is presented as customer sales or external market share.
  const demandScore = clampScore(25 + Math.log10(1 + listingsPerDay) * 45, 20, 90);
  const competitionScore = clampScore(15 + Math.log10(1 + product.listedNum) * 25, 15, 90);
  return { demandScore, competitionScore, ageDays, listingsPerDay };
}

function supplierOperationalScore(product: CJProduct, stock: CJVariantStock | null | undefined, freight: CJFreightOption | null) {
  if (!product.supplierId || stock?.totalInventory === null || stock?.totalInventory === undefined || !freight) return null;
  let score = 60;
  if (product.status === '3') score += 15;
  if (stock.totalInventory > 0) score += 10;
  if (stock.warehouses.some((warehouse) => warehouse.totalInventory !== null)) score += 5;
  if (freight.totalCostUsd >= 0) score += 5;
  return clampScore(score, 0, 95);
}

export function selectCJVariant(variants: CJVariant[]): CJVariant | null {
  return variants
    .filter((variant) => Boolean(variant.vid) && typeof variant.variantSellPrice === 'number' && variant.variantSellPrice > 0)
    .sort((a, b) => (a.variantSellPrice! - b.variantSellPrice!) || a.vid.localeCompare(b.vid))[0] || null;
}

export function selectCJFreight(options: CJFreightOption[]): CJFreightOption | null {
  return options
    .filter((option) => Number.isFinite(option.totalCostUsd) && option.totalCostUsd >= 0)
    .sort((a, b) => a.totalCostUsd - b.totalCostUsd)[0] || null;
}

function convertProviderAmount(amount: number | null, config: SourcingConfig): number | null {
  if (amount === null || !Number.isFinite(amount) || amount < 0) return null;
  if (config.providerCurrency === config.currency) return amount;
  if (config.providerToStoreRate === null || !Number.isFinite(config.providerToStoreRate) || config.providerToStoreRate <= 0) return null;
  return Math.round(amount * config.providerToStoreRate * 100) / 100;
}

export function buildCJLiveEvidence(input: {
  product: CJProduct;
  detail?: CJProduct | null;
  variants: CJVariant[];
  stock?: CJVariantStock | null;
  freight: CJFreightOption[];
  config: SourcingConfig;
  imageSaleUseAllowed?: boolean;
  now?: number;
}): Evidence {
  const { product, config } = input;
  const detail = input.detail || product;
  const now = input.now ?? Date.now();
  const variant = selectCJVariant(input.variants.length ? input.variants : (detail.variants || []));
  const freight = selectCJFreight(input.freight);
  const providerCost = variant?.variantSellPrice ?? null;
  const providerShipping = freight?.totalCostUsd ?? null;
  const supplierCost = convertProviderAmount(providerCost, config);
  const shippingCost = convertProviderAmount(providerShipping, config);
  const stock = input.stock?.totalInventory ?? (variant?.stockQuantity ?? detail.stockQuantity ?? null);
  const title = detail.productNameEn || detail.productName || product.productNameEn || product.productName;
  const image = variant?.variantImage || detail.productImage || product.productImage;
  const sourceUrl = detail.productUrl || product.productUrl || `https://cjdropshipping.com/product-p-${product.pid}.html`;
  const notes: string[] = ['CJ_VARIANT_OBSERVED'];
  if (input.stock) notes.push('CJ_VARIANT_STOCK_OBSERVED');
  if (freight) notes.push('CJ_FREIGHT_TO_DESTINATION_OBSERVED');
  if (config.providerCurrency !== config.currency) {
    if (config.providerToStoreRate) notes.push('CONFIGURED_PROVIDER_TO_STORE_FX');
    else notes.push('FX_RATE_REQUIRED');
  }
  if (!input.imageSaleUseAllowed) notes.push('IMAGE_SALE_USE_POLICY_NOT_CONFIRMED');

  const policyComplete = [
    config.customsRatePct,
    config.paymentFeePct,
    config.paymentFeeFixed,
    config.returnReservePct,
    config.acquisitionCost,
    config.taxRatePct,
  ].every((value) => typeof value === 'number' && Number.isFinite(value));

  const signals = config.commercialProxiesAllowed ? listingSignals(detail, now) : {
    demandScore: null, competitionScore: null, ageDays: null, listingsPerDay: null,
  };
  const supplierScore = config.commercialProxiesAllowed ? supplierOperationalScore(detail, input.stock, freight) : null;
  const observedLogisticsScore = freight ? logisticsScore(freight) : null;
  if (config.commercialProxiesAllowed) notes.push('SHADOW_CJ_COMMERCIAL_PROXIES');

  const candidate: OpportunityCandidate | undefined = variant && supplierCost !== null && shippingCost !== null && policyComplete
    ? {
      id: `cj:${product.pid}:${variant.vid}:${config.destination}`,
      title: title || variant.variantNameEn || variant.variantSku || product.pid,
      source: 'cj',
      sourceUrl,
      pricing: {
        supplierCost,
        supplierShipping: shippingCost,
        customsRatePct: config.customsRatePct!,
        paymentFeePct: config.paymentFeePct!,
        paymentFeeFixed: config.paymentFeeFixed!,
        returnReservePct: config.returnReservePct!,
        acquisitionCost: config.acquisitionCost!,
        taxRatePct: config.taxRatePct!,
        targetNetMarginPct: config.minMargin ?? undefined,
        currency: config.currency,
        provenance: { supplierCost: 'observed', supplierShipping: 'observed' },
      },
      demandScore: signals.demandScore ?? undefined,
      supplierReliabilityScore: supplierScore ?? undefined,
      logisticsScore: observedLogisticsScore ?? undefined,
      competitionScore: signals.competitionScore ?? undefined,
      evidence: {
        title: 'observed',
        source: 'observed',
        demand: signals.demandScore !== null ? 'observed' : 'unknown',
        supplierReliability: supplierScore !== null ? 'observed' : 'unknown',
        logistics: observedLogisticsScore !== null ? 'observed' : 'unknown',
        competition: signals.competitionScore !== null ? 'observed' : 'unknown',
      },
      metadata: {
        providerCurrency: config.providerCurrency,
        providerCost,
        providerShipping,
        fxRate: config.providerToStoreRate,
        variantSku: variant.variantSku,
        freightMethod: freight?.logisticName || null,
        freightAging: freight?.logisticAging || null,
        commercialProxyPolicy: config.commercialProxiesAllowed ? 'shadow_cj_operational_signals_v1' : null,
        cjListedNum: detail.listedNum ?? null,
        cjProductAgeDays: signals.ageDays,
        cjListingsPerDay: signals.listingsPerDay,
        evidenceNotes: notes,
      },
    }
    : undefined;

  return {
    provider: 'cj',
    productId: product.pid,
    variantId: variant?.vid,
    observedAt: new Date(now).toISOString(),
    sourceUrl,
    currency: supplierCost !== null && shippingCost !== null ? config.currency : null,
    providerCurrency: config.providerCurrency,
    fxRate: config.providerToStoreRate,
    stock,
    supplierCost,
    shippingCost,
    destination: config.destination,
    shippingVerified: Boolean(freight),
    imageRightsVerified: Boolean(input.imageSaleUseAllowed && image),
    evidenceNotes: notes,
    candidate,
    facts: {
      category: detail.categoryName || product.categoryName || undefined,
      description: (detail.description || detail.productNameEn || detail.productName || '').slice(0, 2000),
      images: image ? [image] : [],
      supplierName: detail.supplierName || product.supplierName || undefined,
      sourceUrl,
      shippingDaysMax: freight ? parseAgingDays(freight.logisticAging) ?? undefined : undefined,
      specs: {
        variantSku: variant?.variantSku || null,
        variantName: variant?.variantNameEn || null,
        variantWeightGrams: variant?.variantWeight ?? null,
        shippingMethod: freight?.logisticName || null,
      },
    },
  };
}

export function evidenceIdentity(e: Evidence) {
  return `cj:${e.productId}:${e.variantId || 'unspecified'}:${e.destination}`;
}

export function evidenceVersion(e: Evidence) {
  return createHash('sha256').update(JSON.stringify(e)).digest('hex');
}

export function validateEvidence(e: Evidence, config: SourcingConfig, now = Date.now()): string[] {
  const missing: string[] = [];
  if (!e.productId || !e.variantId) missing.push('VARIANT_IDENTITY_REQUIRED');
  if (config.providerCurrency !== config.currency && (!config.providerToStoreRate || config.providerToStoreRate <= 0)) missing.push('FX_RATE_REQUIRED');
  if (!e.currency || e.currency !== config.currency || e.candidate?.pricing.currency !== e.currency) missing.push('VERIFIED_CURRENCY_OR_FX_REQUIRED');
  if (typeof e.supplierCost !== 'number' || !Number.isFinite(e.supplierCost) || e.supplierCost <= 0) missing.push('SUPPLIER_COST_REQUIRED');
  if (e.shippingCost === null || !Number.isFinite(e.shippingCost) || e.shippingCost < 0 || !e.shippingVerified || e.destination !== config.destination) missing.push('SHIPPING_EVIDENCE_REQUIRED');
  if (e.stock === null || !Number.isSafeInteger(e.stock) || e.stock < 0) missing.push('STOCK_EVIDENCE_REQUIRED');
  if (!e.imageRightsVerified) missing.push('IMAGE_RIGHTS_REQUIRED');
  const time = Date.parse(e.observedAt);
  if (!Number.isFinite(time) || now - time > 86400000 || time > now + 60000) missing.push('FRESH_EVIDENCE_REQUIRED');
  if (!/^https:\/\//.test(e.sourceUrl)) missing.push('SOURCE_REQUIRED');
  if (config.minMargin === null) missing.push('MARGIN_POLICY_REQUIRED');
  const p = e.candidate?.pricing;
  if (!p || p.supplierCost !== e.supplierCost || p.supplierShipping !== e.shippingCost ||
    !['verified', 'observed'].includes(p.provenance?.supplierCost || '') ||
    !['verified', 'observed'].includes(p.provenance?.supplierShipping || '')) missing.push('PRICING_EVIDENCE_REQUIRED');
  for (const key of ['customsRatePct', 'paymentFeePct', 'paymentFeeFixed', 'returnReservePct', 'acquisitionCost', 'taxRatePct'] as const) {
    const value = p?.[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) missing.push(`COST_COMPONENT_REQUIRED:${key}`);
  }
  for (const key of ['demand', 'supplierReliability', 'logistics', 'competition'] as const) {
    if (!['observed', 'verified'].includes(e.candidate?.evidence?.[key] || '')) missing.push(`COMMERCIAL_EVIDENCE_REQUIRED:${key}`);
  }
  for (const key of ['demandScore', 'supplierReliabilityScore', 'logisticsScore', 'competitionScore'] as const) {
    const value = e.candidate?.[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) missing.push(`OBSERVED_SCORE_REQUIRED:${key}`);
  }
  if (!e.facts.images?.length) missing.push('PRODUCT_IMAGES_REQUIRED');
  return [...new Set(missing)];
}
