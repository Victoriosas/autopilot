export interface PromotionInput {
  currentPrice: number;
  unitCost: number;
  paymentFeePct?: number;
  returnReservePct?: number;
  taxRatePct?: number;
  requestedDiscountPct: number;
  minimumNetMarginPct?: number;
}

export interface PromotionDecision {
  allowed: boolean;
  promotionalPrice?: number;
  effectiveDiscountPct?: number;
  estimatedNetMarginPct?: number;
  reason: string;
  policy: {
    compareAtPriceMayBeDisplayed: boolean;
    fakeReferencePriceAllowed: false;
    councilApprovalRequired: boolean;
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function evaluatePromotion(input: PromotionInput): PromotionDecision {
  const currentPrice = Number(input.currentPrice);
  const unitCost = Number(input.unitCost);
  const requestedDiscountPct = Number(input.requestedDiscountPct);
  const minimumNetMarginPct = Number(input.minimumNetMarginPct ?? 15);
  const variableRate = (
    Number(input.paymentFeePct ?? 4) +
    Number(input.returnReservePct ?? 4) +
    Number(input.taxRatePct ?? 0)
  ) / 100;

  if (!Number.isFinite(currentPrice) || currentPrice <= 0 || !Number.isFinite(unitCost) || unitCost <= 0) {
    return { allowed: false, reason: 'Precio o costo inválido.', policy: { compareAtPriceMayBeDisplayed: false, fakeReferencePriceAllowed: false, councilApprovalRequired: true } };
  }
  if (!Number.isFinite(requestedDiscountPct) || requestedDiscountPct <= 0 || requestedDiscountPct >= 80) {
    return { allowed: false, reason: 'Descuento solicitado fuera de rango seguro.', policy: { compareAtPriceMayBeDisplayed: false, fakeReferencePriceAllowed: false, councilApprovalRequired: true } };
  }

  const promotionalPrice = round2(currentPrice * (1 - requestedDiscountPct / 100));
  const variableCosts = promotionalPrice * variableRate;
  const profit = promotionalPrice - unitCost - variableCosts;
  const netMarginPct = round2((profit / promotionalPrice) * 100);

  if (netMarginPct < minimumNetMarginPct) {
    return {
      allowed: false,
      promotionalPrice,
      effectiveDiscountPct: round2((1 - promotionalPrice / currentPrice) * 100),
      estimatedNetMarginPct: netMarginPct,
      reason: `La promoción bajaría el margen neto estimado a ${netMarginPct}%, por debajo del mínimo ${minimumNetMarginPct}%.`,
      policy: { compareAtPriceMayBeDisplayed: false, fakeReferencePriceAllowed: false, councilApprovalRequired: true },
    };
  }

  return {
    allowed: true,
    promotionalPrice,
    effectiveDiscountPct: round2((1 - promotionalPrice / currentPrice) * 100),
    estimatedNetMarginPct: netMarginPct,
    reason: 'Promoción económicamente viable con precio de referencia real.',
    policy: {
      compareAtPriceMayBeDisplayed: true,
      fakeReferencePriceAllowed: false,
      councilApprovalRequired: requestedDiscountPct >= 20,
    },
  };
}
