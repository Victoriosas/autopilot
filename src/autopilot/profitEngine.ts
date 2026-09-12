export interface ProfitInput {
  revenue: number;
  units: number;
  unitCost: number;
  paymentFees?: number;
  acquisitionCost?: number;
  refunds?: number;
  shippingSubsidy?: number;
  taxes?: number;
}

export interface ProfitSummary {
  revenue: number;
  units: number;
  grossProfit: number;
  contributionProfit: number;
  realizedMarginPct: number;
  profitPerUnit: number;
  breakEvenUnits?: number;
  warnings: string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function calculateRealizedProfit(input: ProfitInput): ProfitSummary {
  const revenue = Math.max(0, Number(input.revenue || 0));
  const units = Math.max(0, Number(input.units || 0));
  const unitCost = Math.max(0, Number(input.unitCost || 0));
  const paymentFees = Math.max(0, Number(input.paymentFees || 0));
  const acquisitionCost = Math.max(0, Number(input.acquisitionCost || 0));
  const refunds = Math.max(0, Number(input.refunds || 0));
  const shippingSubsidy = Math.max(0, Number(input.shippingSubsidy || 0));
  const taxes = Math.max(0, Number(input.taxes || 0));
  const warnings: string[] = [];

  const cogs = unitCost * units;
  const grossProfit = revenue - cogs;
  const contributionProfit = grossProfit - paymentFees - acquisitionCost - refunds - shippingSubsidy - taxes;
  const realizedMarginPct = revenue > 0 ? (contributionProfit / revenue) * 100 : 0;
  const profitPerUnit = units > 0 ? contributionProfit / units : 0;

  if (units === 0 && revenue > 0) warnings.push('Revenue exists with zero units; source data should be reconciled.');
  if (contributionProfit < 0) warnings.push('Negative contribution profit detected.');
  if (unitCost === 0 && units > 0) warnings.push('Unit cost is zero or unavailable; profit may be overstated.');

  return {
    revenue: round2(revenue),
    units,
    grossProfit: round2(grossProfit),
    contributionProfit: round2(contributionProfit),
    realizedMarginPct: round2(realizedMarginPct),
    profitPerUnit: round2(profitPerUnit),
    warnings,
  };
}
