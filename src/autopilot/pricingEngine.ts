export type PricingStrategy = 'conservative' | 'balanced' | 'aggressive';
export type PriceProvenance = 'verified' | 'observed' | 'inferred' | 'generated' | 'unknown';

export interface PricingInput {
  supplierCost: number;
  supplierShipping?: number;
  customsRatePct?: number;
  paymentFeePct?: number;
  paymentFeeFixed?: number;
  returnReservePct?: number;
  acquisitionCost?: number;
  taxRatePct?: number;
  targetNetMarginPct?: number;
  strategy?: PricingStrategy;
  marketPrice?: number;
  currency?: string;
  provenance?: {
    supplierCost?: PriceProvenance;
    supplierShipping?: PriceProvenance;
    marketPrice?: PriceProvenance;
  };
}

export interface PricingQuote {
  currency: string;
  strategy: PricingStrategy;
  landedCost: number;
  floorPrice: number;
  recommendedPrice: number;
  premiumCeiling: number;
  estimatedProfit: number;
  estimatedNetMarginPct: number;
  revenueScore: number;
  confidence: number;
  warnings: string[];
  breakdown: Record<string, number>;
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function requireFinite(name: string, value: number, min = 0): number {
  if (!Number.isFinite(value) || value < min) throw new Error(`${name} must be a finite number >= ${min}`);
  return value;
}

function psychological(value: number): number {
  if (value <= 0) return 0;
  const whole = Math.ceil(value);
  return round2(Math.max(0.99, whole - 0.1));
}

function confidenceFrom(input: PricingInput): number {
  const provenance = input.provenance || {};
  const score = (value?: PriceProvenance) => {
    if (value === 'verified') return 1;
    if (value === 'observed') return 0.85;
    if (value === 'inferred') return 0.6;
    if (value === 'generated') return 0.35;
    return 0.15;
  };
  const supplier = score(provenance.supplierCost);
  const shipping = input.supplierShipping ? score(provenance.supplierShipping) : 0.7;
  const market = input.marketPrice ? score(provenance.marketPrice) : 0.45;
  return Math.round(((supplier * 0.55) + (shipping * 0.2) + (market * 0.25)) * 100);
}

export function calculatePricingQuote(input: PricingInput): PricingQuote {
  const supplierCost = requireFinite('supplierCost', Number(input.supplierCost), 0.01);
  const supplierShipping = requireFinite('supplierShipping', Number(input.supplierShipping || 0));
  const customsRatePct = requireFinite('customsRatePct', Number(input.customsRatePct || 0));
  const paymentFeePct = requireFinite('paymentFeePct', Number(input.paymentFeePct ?? 4));
  const paymentFeeFixed = requireFinite('paymentFeeFixed', Number(input.paymentFeeFixed || 0));
  const returnReservePct = requireFinite('returnReservePct', Number(input.returnReservePct ?? 4));
  const acquisitionCost = requireFinite('acquisitionCost', Number(input.acquisitionCost || 0));
  const taxRatePct = requireFinite('taxRatePct', Number(input.taxRatePct || 0));
  const targetNetMarginPct = clamp(requireFinite('targetNetMarginPct', Number(input.targetNetMarginPct ?? 35)), 5, 75);
  const strategy: PricingStrategy = input.strategy || 'balanced';
  const currency = (input.currency || 'USD').toUpperCase();
  const marketPrice = input.marketPrice === undefined ? undefined : requireFinite('marketPrice', Number(input.marketPrice), 0.01);

  const customs = (supplierCost + supplierShipping) * (customsRatePct / 100);
  const baseCost = supplierCost + supplierShipping + customs + acquisitionCost;
  const variableRate = (paymentFeePct + returnReservePct + taxRatePct) / 100;
  if (variableRate >= 0.9) throw new Error('Combined variable rates are too high to price safely');

  const priceForMargin = (marginPct: number) => {
    const denominator = 1 - variableRate - (marginPct / 100);
    if (denominator <= 0.05) throw new Error('Requested margin is incompatible with fee/tax rates');
    return (baseCost + paymentFeeFixed) / denominator;
  };

  const marginTargets: Record<PricingStrategy, number> = {
    conservative: Math.max(15, targetNetMarginPct - 10),
    balanced: targetNetMarginPct,
    aggressive: Math.min(70, targetNetMarginPct + 10),
  };

  const floorRaw = priceForMargin(Math.max(10, targetNetMarginPct - 15));
  let recommendedRaw = priceForMargin(marginTargets[strategy]);
  let ceilingRaw = priceForMargin(Math.min(75, targetNetMarginPct + 20));

  const warnings: string[] = [];
  if (marketPrice) {
    const marketCeiling = marketPrice * 1.08;
    ceilingRaw = Math.min(ceilingRaw, marketCeiling);
    if (recommendedRaw > marketCeiling) {
      warnings.push('Target margin exceeds observed market ceiling; recommendation capped near market price.');
      recommendedRaw = Math.max(floorRaw, marketCeiling);
    }
  } else {
    warnings.push('No market price supplied; competitive ceiling is unverified.');
  }

  const floorPrice = psychological(floorRaw);
  const recommendedPrice = psychological(Math.max(floorRaw, recommendedRaw));
  const premiumCeiling = psychological(Math.max(recommendedPrice, ceilingRaw));

  const paymentFee = (recommendedPrice * paymentFeePct / 100) + paymentFeeFixed;
  const returnReserve = recommendedPrice * returnReservePct / 100;
  const taxes = recommendedPrice * taxRatePct / 100;
  const estimatedProfit = round2(recommendedPrice - baseCost - paymentFee - returnReserve - taxes);
  const estimatedNetMarginPct = round2((estimatedProfit / recommendedPrice) * 100);
  const confidence = confidenceFrom(input);

  if (!input.provenance?.supplierCost || ['generated', 'unknown'].includes(input.provenance.supplierCost)) {
    warnings.push('Supplier cost is not verified/observed. Do not auto-publish or auto-purchase from this quote.');
  }

  const marketFit = marketPrice ? clamp(1 - Math.abs(recommendedPrice - marketPrice) / marketPrice, 0, 1) : 0.5;
  const revenueScore = Math.round(clamp((estimatedNetMarginPct / 60) * 55 + marketFit * 20 + (confidence / 100) * 25, 0, 100));

  return {
    currency,
    strategy,
    landedCost: round2(baseCost),
    floorPrice,
    recommendedPrice,
    premiumCeiling,
    estimatedProfit,
    estimatedNetMarginPct,
    revenueScore,
    confidence,
    warnings,
    breakdown: {
      supplierCost: round2(supplierCost),
      supplierShipping: round2(supplierShipping),
      customs: round2(customs),
      acquisitionCost: round2(acquisitionCost),
      paymentFee: round2(paymentFee),
      returnReserve: round2(returnReserve),
      taxes: round2(taxes),
    },
  };
}
