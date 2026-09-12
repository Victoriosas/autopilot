import { aiStructuredCompletion } from './aiClient';

export type FactProvenance = 'verified' | 'observed' | 'inferred' | 'generated' | 'unknown';

export interface ProductAnalysis {
  title: string;
  subtitle: string;
  description: string;
  category: string;
  tags: string[];
  features: string[];
  specs: Record<string, string>;
  badges: string[];
  pricing: {
    suggestedPrice: number;
    compareAtPrice: number;
    margin: number;
    marginPct: number;
  };
  analysis: {
    demandScore: number;
    competitionLevel: string;
    marginPotential: number;
    brandFitScore: number;
    qualityScore: number;
    logisticsScore: number;
    overallScore: number;
    scoreTier: string;
    revenueScore: number;
    confidenceScore: number;
    targetAudience: string;
    keySellingPoints: string[];
  };
  risk: {
    level: string;
    copyrightRisk: string;
    claimsRisk: string;
    supplierRisk: string;
    returnRisk: string;
    details: string[];
  };
  provenance: Record<string, FactProvenance>;
}

const VICTORIOSA_IDENTITY = `
Eres el analista de catálogo de Victoriosa. Tu trabajo es preparar BORRADORES para revisión humana.
Nunca inventes hechos del proveedor. No afirmes garantía, certificaciones, materiales, stock, tiempos de envío,
valoraciones, demanda real, seguridad, origen o calidad si esos datos no aparecen en la entrada.
Puedes generar copy comercial, pero debe distinguirse de los hechos observados.
Si un dato no está disponible, omítelo o indícalo como desconocido.
`;

function finiteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value: unknown, fallback = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

export function calculatePricing(cost: number, shipping: number = 0, targetMarginPct: number = 55) {
  const safeCost = Math.max(0, Number(cost) || 0);
  const safeShipping = Math.max(0, Number(shipping) || 0);
  const marginTarget = Math.max(5, Math.min(85, Number(targetMarginPct) || 55));
  const totalCost = safeCost + safeShipping;
  if (totalCost <= 0) {
    return { suggestedPrice: 0, compareAtPrice: 0, margin: 0, marginPct: 0 };
  }

  const rawPrice = totalCost / (1 - marginTarget / 100);
  let roundedPrice = Math.ceil(rawPrice * 100) / 100;
  if (roundedPrice >= 10) roundedPrice = Math.floor(roundedPrice) + 0.95;
  const compareAtPrice = Number((roundedPrice * 1.2).toFixed(2));
  const margin = Number((roundedPrice - totalCost).toFixed(2));
  const marginPct = Number(((margin / roundedPrice) * 100).toFixed(1));
  return { suggestedPrice: roundedPrice, compareAtPrice, margin, marginPct };
}

function riskPenalty(level: string) {
  if (level === 'critical') return 50;
  if (level === 'high') return 30;
  if (level === 'medium') return 15;
  if (level === 'low') return 5;
  return 20;
}

export function calculateRevenueScore(input: {
  marginPct: number;
  demandScore: number;
  brandFitScore: number;
  logisticsScore: number;
  riskLevel: string;
  confidenceScore: number;
}) {
  const marginScore = clamp((input.marginPct / 70) * 100);
  const raw =
    marginScore * 0.35 +
    clamp(input.demandScore) * 0.25 +
    clamp(input.brandFitScore) * 0.2 +
    clamp(input.logisticsScore) * 0.2;
  const confidenceMultiplier = 0.45 + clamp(input.confidenceScore) / 180;
  return Math.round(Math.max(0, Math.min(100, raw * confidenceMultiplier - riskPenalty(input.riskLevel))));
}

function sourceProvenance(product: any) {
  const costKnown = finiteNumber(product.costPrice ?? product.salePrice ?? product.sellPrice) !== null;
  const shippingKnown = finiteNumber(product.shippingCost) !== null;
  const stockKnown = finiteNumber(product.stockQuantity) !== null;
  return {
    supplierPrice: costKnown ? 'observed' : 'unknown',
    shippingCost: shippingKnown ? 'observed' : 'unknown',
    stock: stockKnown ? 'observed' : 'unknown',
    sourceUrl: product.productUrl ? 'observed' : 'unknown',
    title: (product.productNameEn || product.productName || product.title) ? 'observed' : 'unknown',
    generatedCopy: 'generated',
    demand: 'inferred',
    competition: 'inferred',
    quality: 'inferred',
    logistics: 'inferred',
  } satisfies Record<string, FactProvenance>;
}

function confidenceFromSource(product: any) {
  let score = 10;
  if (finiteNumber(product.costPrice ?? product.salePrice ?? product.sellPrice) !== null) score += 30;
  if (finiteNumber(product.shippingCost) !== null) score += 15;
  if (finiteNumber(product.stockQuantity) !== null) score += 15;
  if (product.productUrl) score += 10;
  if (product.productSku || product.sku) score += 10;
  if (product.productImage) score += 5;
  return Math.min(100, score);
}

export async function analyzeProduct(product: any, _aiClient?: any): Promise<ProductAnalysis | null> {
  const cost = finiteNumber(product.costPrice ?? product.salePrice ?? product.sellPrice);
  if (cost === null || cost <= 0) {
    console.warn('[Analyzer] Product skipped: supplier cost is not observed');
    return null;
  }

  const observedShipping = finiteNumber(product.shippingCost);
  const shippingForEstimate = observedShipping ?? 0;
  const pricing = calculatePricing(cost, shippingForEstimate, 55);
  const provenance = sourceProvenance(product);
  const sourceConfidence = confidenceFromSource(product);

  const sourceFacts = {
    title: product.productNameEn || product.productName || product.title || null,
    category: product.categoryName || product.category || null,
    supplierPrice: cost,
    shippingCost: observedShipping,
    sku: product.productSku || product.sku || null,
    weight: finiteNumber(product.productWeight),
    stock: finiteNumber(product.stockQuantity),
    url: product.productUrl || null,
  };

  const prompt = `
${VICTORIOSA_IDENTITY}

HECHOS OBSERVADOS DEL PROVEEDOR:
${JSON.stringify(sourceFacts, null, 2)}

Genera un borrador comercial en español. Las puntuaciones de demanda, competencia, calidad y logística son únicamente
INFERENCIAS y no deben presentarse al cliente como hechos. No añadas garantías, certificaciones, reseñas, materiales,
tiempos de entrega ni afirmaciones médicas que no estén en HECHOS OBSERVADOS.

Devuelve SOLO JSON con esta forma:
{
  "title": "...",
  "subtitle": "...",
  "description": "...",
  "category": "...",
  "tags": ["..."],
  "features": ["..."],
  "specs": {},
  "badges": [],
  "analysis": {
    "demandScore": 0,
    "competitionLevel": "unknown",
    "brandFitScore": 0,
    "qualityScore": 0,
    "logisticsScore": 0,
    "overallScore": 0,
    "scoreTier": "D",
    "targetAudience": "...",
    "keySellingPoints": []
  },
  "risk": {
    "level": "medium",
    "copyrightRisk": "unknown",
    "claimsRisk": "unknown",
    "supplierRisk": "unknown",
    "returnRisk": "unknown",
    "details": []
  }
}
`;

  try {
    const parsed = await aiStructuredCompletion<any>(prompt, null);
    if (!parsed) return generateFallbackAnalysis(product, pricing, provenance, sourceConfidence, observedShipping !== null);

    const riskLevel = ['low', 'medium', 'high', 'critical'].includes(parsed.risk?.level) ? parsed.risk.level : 'medium';
    const demandScore = clamp(parsed.analysis?.demandScore, 20);
    const brandFitScore = clamp(parsed.analysis?.brandFitScore, 40);
    const qualityScore = clamp(parsed.analysis?.qualityScore, 20);
    const logisticsScore = clamp(parsed.analysis?.logisticsScore, observedShipping !== null ? 40 : 20);
    const confidenceScore = Math.min(100, sourceConfidence + 10);
    const revenueScore = calculateRevenueScore({
      marginPct: pricing.marginPct,
      demandScore,
      brandFitScore,
      logisticsScore,
      riskLevel,
      confidenceScore,
    });
    const overallScore = Math.round((brandFitScore + qualityScore + logisticsScore + demandScore) / 4);

    return {
      title: String(parsed.title || sourceFacts.title || 'Producto Victoriosa').slice(0, 120),
      subtitle: String(parsed.subtitle || ''),
      description: String(parsed.description || ''),
      category: String(parsed.category || sourceFacts.category || 'General'),
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String).slice(0, 10) : [],
      features: Array.isArray(parsed.features) ? parsed.features.map(String).slice(0, 8) : [],
      specs: parsed.specs && typeof parsed.specs === 'object' ? parsed.specs : {},
      badges: Array.isArray(parsed.badges) ? parsed.badges.map(String).slice(0, 5) : [],
      pricing,
      analysis: {
        demandScore,
        competitionLevel: String(parsed.analysis?.competitionLevel || 'unknown'),
        marginPotential: pricing.marginPct,
        brandFitScore,
        qualityScore,
        logisticsScore,
        overallScore,
        scoreTier: revenueScore >= 80 ? 'A' : revenueScore >= 65 ? 'B' : revenueScore >= 50 ? 'C' : 'D',
        revenueScore,
        confidenceScore,
        targetAudience: String(parsed.analysis?.targetAudience || ''),
        keySellingPoints: Array.isArray(parsed.analysis?.keySellingPoints) ? parsed.analysis.keySellingPoints.map(String).slice(0, 6) : [],
      },
      risk: {
        level: riskLevel,
        copyrightRisk: String(parsed.risk?.copyrightRisk || 'unknown'),
        claimsRisk: String(parsed.risk?.claimsRisk || 'unknown'),
        supplierRisk: String(parsed.risk?.supplierRisk || 'unknown'),
        returnRisk: String(parsed.risk?.returnRisk || 'unknown'),
        details: Array.isArray(parsed.risk?.details) ? parsed.risk.details.map(String).slice(0, 8) : [],
      },
      provenance,
    };
  } catch (error) {
    console.error('[Analyzer] AI analysis failed:', error);
    return generateFallbackAnalysis(product, pricing, provenance, sourceConfidence, observedShipping !== null);
  }
}

function generateFallbackAnalysis(
  product: any,
  pricing: ProductAnalysis['pricing'],
  provenance: Record<string, FactProvenance>,
  sourceConfidence: number,
  shippingKnown: boolean,
): ProductAnalysis {
  const originalTitle = String(product.productNameEn || product.productName || product.title || 'Producto sin título');
  const riskLevel = shippingKnown ? 'medium' : 'high';
  const demandScore = 10;
  const brandFitScore = 35;
  const qualityScore = 10;
  const logisticsScore = shippingKnown ? 35 : 10;
  const confidenceScore = Math.max(10, sourceConfidence - 10);
  const revenueScore = calculateRevenueScore({
    marginPct: pricing.marginPct,
    demandScore,
    brandFitScore,
    logisticsScore,
    riskLevel,
    confidenceScore,
  });

  return {
    title: originalTitle.slice(0, 120),
    subtitle: '',
    description: 'Borrador generado a partir de datos limitados del proveedor. Requiere revisión antes de publicarse.',
    category: String(product.categoryName || product.category || 'General'),
    tags: [],
    features: [],
    specs: {},
    badges: [],
    pricing,
    analysis: {
      demandScore,
      competitionLevel: 'unknown',
      marginPotential: pricing.marginPct,
      brandFitScore,
      qualityScore,
      logisticsScore,
      overallScore: 20,
      scoreTier: 'D',
      revenueScore,
      confidenceScore,
      targetAudience: '',
      keySellingPoints: [],
    },
    risk: {
      level: riskLevel,
      copyrightRisk: 'unknown',
      claimsRisk: 'unknown',
      supplierRisk: 'unknown',
      returnRisk: 'unknown',
      details: ['Datos insuficientes: requiere verificación humana antes de publicar.'],
    },
    provenance,
  };
}
