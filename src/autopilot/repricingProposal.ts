import { calculatePricingQuote, type PricingQuote } from './pricingEngine';
import type { CatalogObservation } from './catalogMonitor';

export type RepricingProposalStatus = 'no_change' | 'review_required' | 'block_sale';

export interface RepricingProposal {
  productId: string;
  status: RepricingProposalStatus;
  currentPrice: number;
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
    supplierPurchaseAllowed: false;
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildRepricingProposal(observation: CatalogObservation): RepricingProposal {
  const provenance = {
    supplierCost: observation.provenance.supplierCost === 'observed' ? 'observed' as const : 'unknown' as const,
    stock: observation.provenance.stock === 'observed' ? 'observed' as const : 'unknown' as const,
  };

  if (observation.observedStock === 0) {
    return {
      productId: observation.productId,
      status: 'block_sale',
      currentPrice: observation.currentPrice,
      reason: 'Proveedor observado sin stock. Se recomienda ocultar la venta hasta nueva verificación.',
      provenance,
      policy: {
        automaticPriceMutationAllowed: false,
        councilApprovalRequired: true,
        supplierPurchaseAllowed: false,
      },
    };
  }

  if (!observation.observedSupplierCost || observation.observedSupplierCost <= 0) {
    return {
      productId: observation.productId,
      status: 'no_change',
      currentPrice: observation.currentPrice,
      reason: 'No existe costo de proveedor observado suficiente para recalcular precio.',
      provenance,
      policy: {
        automaticPriceMutationAllowed: false,
        councilApprovalRequired: true,
        supplierPurchaseAllowed: false,
      },
    };
  }

  const quote = calculatePricingQuote({
    supplierCost: observation.observedSupplierCost,
    targetNetMarginPct: 35,
    strategy: 'balanced',
    currency: 'USD',
    provenance: {
      supplierCost: 'observed',
    },
  });

  const currentPrice = observation.currentPrice;
  const proposedPrice = quote.recommendedPrice;
  const deltaPct = currentPrice > 0 ? round2(((proposedPrice - currentPrice) / currentPrice) * 100) : 100;
  const meaningful = Math.abs(deltaPct) >= 8;

  return {
    productId: observation.productId,
    status: meaningful ? 'review_required' : 'no_change',
    currentPrice,
    proposedPrice,
    deltaPct,
    reason: meaningful
      ? `Cambio sugerido de ${deltaPct}% por variación observada del costo y margen objetivo.`
      : `La variación sugerida (${deltaPct}%) está dentro del umbral de estabilidad.`,
    quote,
    provenance,
    policy: {
      automaticPriceMutationAllowed: false,
      councilApprovalRequired: true,
      supplierPurchaseAllowed: false,
    },
  };
}
