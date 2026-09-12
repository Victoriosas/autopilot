import { calculatePricingQuote, type PricingQuote } from './pricingEngine';
import type { CatalogObservation } from './catalogMonitor';

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

export function buildRepricingProposal(observation: CatalogObservation): RepricingProposal {
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

  const quote = calculatePricingQuote({
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
    provenance,
    policy: policy(ownerApprovalRequired),
  };
}
