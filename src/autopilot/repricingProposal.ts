import { calculatePricingQuote, type PricingQuote } from './pricingEngine';
import type { CatalogObservation } from './catalogMonitor';

// Explicit owner/supplier cost sheet, in the same currency as the observation.
// A zero is accepted only when supplied explicitly; missing costs never use defaults.
export interface RepricingCostEvidence {
  currency: string;
  sourceReference: string;
  supplierShipping: number;
  customsRatePct: number;
  paymentFeePct: number;
  paymentFeeFixed: number;
  returnReservePct: number;
  acquisitionCost: number;
  taxRatePct: number;
}

export function validRepricingCosts(value: unknown, currency: string): value is RepricingCostEvidence {
  if (!value || typeof value !== 'object') return false;
  const c = value as RepricingCostEvidence;
  if (!/^[A-Z]{3}$/.test(currency) || c.currency !== currency
    || typeof c.sourceReference !== 'string' || !c.sourceReference.trim()) return false;
  const amounts = [c.supplierShipping, c.paymentFeeFixed, c.acquisitionCost];
  const rates = [c.customsRatePct, c.paymentFeePct, c.returnReservePct, c.taxRatePct];
  return amounts.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0)
    && rates.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100)
    && c.paymentFeePct + c.returnReservePct + c.taxRatePct < 60;
}

export type RepricingProposalStatus = 'no_change' | 'review_required' | 'block_sale';

export interface RepricingProposal {
  productId: string;
  status: RepricingProposalStatus;
  currentPrice: number;
  currency: string;
  proposedPrice?: number;
  deltaPct?: number;
  reason: string;
  quote?: PricingQuote;
  costEvidence?: RepricingCostEvidence;
  provenance: {
    supplierCost: 'observed' | 'unknown';
    stock: 'observed' | 'unknown';
  };
  policy: {
    automaticPriceMutationAllowed: false;
    councilApprovalRequired: true;
    ownerApprovalRequired: boolean;
    supplierPurchaseAllowed: false;
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function policy(ownerApprovalRequired: boolean) {
  return {
    automaticPriceMutationAllowed: false as const,
    councilApprovalRequired: true as const,
    ownerApprovalRequired,
    supplierPurchaseAllowed: false as const,
  };
}

export function buildRepricingProposal(observation: CatalogObservation, costs?: RepricingCostEvidence): RepricingProposal {
  const currency = String(observation.currency || process.env.STORE_CURRENCY || 'UYU').toUpperCase();
  const provenance = {
    supplierCost: observation.provenance.supplierCost === 'observed' ? 'observed' as const : 'unknown' as const,
    stock: observation.provenance.stock === 'observed' ? 'observed' as const : 'unknown' as const,
  };

  if (observation.observedStock === 0) {
    return {
      productId: observation.productId,
      status: 'block_sale',
      currentPrice: observation.currentPrice,
      currency,
      reason: 'Proveedor observado sin stock. Se recomienda ocultar la venta hasta nueva verificación.',
      provenance,
      policy: policy(true),
    };
  }

  if (!observation.observedSupplierCost || observation.observedSupplierCost <= 0) {
    return {
      productId: observation.productId,
      status: 'no_change',
      currentPrice: observation.currentPrice,
      currency,
      reason: 'No existe costo de proveedor observado suficiente para recalcular precio.',
      provenance,
      policy: policy(false),
    };
  }

  if (!validRepricingCosts(costs, currency) || observation.currency !== currency
    || provenance.supplierCost !== 'observed'
    || !Number.isFinite(observation.currentPrice) || observation.currentPrice <= 0
    || !Number.isFinite(observation.observedSupplierCost)) {
    return {
      productId: observation.productId, status: 'no_change',
      currentPrice: observation.currentPrice, currency, provenance,
      reason: 'Faltan costos completos documentados, moneda coincidente o precio válido; no se propone repricing comercial.',
      policy: policy(false),
    };
  }

  const quote = calculatePricingQuote({
    ...costs,
    supplierCost: observation.observedSupplierCost,
    targetNetMarginPct: 35,
    strategy: 'balanced',
    currency,
    provenance: {
      supplierCost: 'observed',
    },
  });

  const currentPrice = observation.currentPrice;
  const proposedPrice = quote.recommendedPrice;
  const deltaPct = currentPrice > 0 ? round2(((proposedPrice - currentPrice) / currentPrice) * 100) : 100;
  const meaningful = Math.abs(deltaPct) >= 8;
  const ownerApprovalRequired = Math.abs(deltaPct) >= 25;

  return {
    productId: observation.productId,
    status: meaningful ? 'review_required' : 'no_change',
    currentPrice,
    currency,
    proposedPrice,
    deltaPct,
    reason: meaningful
      ? `Cambio sugerido de ${deltaPct}% por variación observada del costo y margen objetivo.`
      : `La variación sugerida (${deltaPct}%) está dentro del umbral de estabilidad.`,
    quote,
    costEvidence: { ...costs },
    provenance,
    policy: policy(ownerApprovalRequired),
  };
}
