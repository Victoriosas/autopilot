import { aiStructuredCompletion } from '../services/aiClient';
import { evaluateOpportunity, type OpportunityCandidate, type OpportunityResult } from './opportunityEngine';

export interface CommercialFacts {
  brand?: string;
  category?: string;
  description?: string;
  features?: string[];
  specs?: Record<string, string | number | boolean | null>;
  images?: string[];
  supplierName?: string;
  shippingDaysMin?: number;
  shippingDaysMax?: number;
  warrantyText?: string;
  sourceUrl?: string;
}

export interface ProductDraft {
  status: 'draft';
  sourceCandidateId: string;
  title: string;
  subtitle: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  category: string;
  tags: string[];
  features: string[];
  specs: Record<string, string | number | boolean | null>;
  images: string[];
  price: number;
  compareAtPrice?: number;
  currency: string;
  provenance: {
    sourceUrl?: string;
    supplierCost: string;
    generatedFields: string[];
    preservedFacts: string[];
  };
  commercial: {
    opportunityScore: number;
    revenueScore: number;
    confidence: number;
    estimatedProfit: number;
    estimatedNetMarginPct: number;
  };
  policy: {
    publishRequiresHumanApproval: true;
    autonomousPurchaseAllowed: false;
  };
  warnings: string[];
}

function compactText(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function slugWords(title: string): string[] {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8);
}

function deterministicDraft(candidate: OpportunityCandidate, result: OpportunityResult, facts: CommercialFacts): ProductDraft {
  const brand = compactText(facts.brand) || 'Victoriosa';
  const rawTitle = compactText(candidate.title);
  const title = rawTitle.length <= 72 ? rawTitle : `${rawTitle.slice(0, 69).trim()}...`;
  const category = compactText(facts.category) || 'Selección Victoriosa';
  const features = Array.isArray(facts.features)
    ? facts.features.map(compactText).filter(Boolean).slice(0, 8)
    : [];
  const preservedFacts = [
    ...(facts.description ? ['description'] : []),
    ...(features.length ? ['features'] : []),
    ...(facts.specs && Object.keys(facts.specs).length ? ['specs'] : []),
    ...(facts.images?.length ? ['images'] : []),
    ...(facts.shippingDaysMin !== undefined || facts.shippingDaysMax !== undefined ? ['shipping'] : []),
    ...(facts.warrantyText ? ['warranty'] : []),
  ];
  const description = compactText(facts.description) || `${title}. Producto seleccionado para evaluación comercial en ${brand}. La publicación final requiere revisión humana de la ficha y sus datos de proveedor.`;
  const tags = Array.from(new Set([brand, category, ...(candidate.tags || []), ...slugWords(title)])).slice(0, 12);
  const price = result.pricing.recommendedPrice;
  const compareAtPrice = result.pricing.premiumCeiling > price ? result.pricing.premiumCeiling : undefined;

  return {
    status: 'draft',
    sourceCandidateId: candidate.id,
    title,
    subtitle: `${brand} · ${category}`,
    description,
    seoTitle: `${title} | ${brand}`.slice(0, 60),
    seoDescription: description.slice(0, 155),
    category,
    tags,
    features,
    specs: facts.specs || {},
    images: Array.isArray(facts.images) ? facts.images.filter((item) => typeof item === 'string' && item.trim()).slice(0, 10) : [],
    price,
    compareAtPrice,
    currency: result.pricing.currency,
    provenance: {
      sourceUrl: compactText(facts.sourceUrl) || compactText(candidate.sourceUrl) || undefined,
      supplierCost: candidate.pricing.provenance?.supplierCost || 'unknown',
      generatedFields: ['title', 'subtitle', 'seoTitle', 'seoDescription', 'tags'],
      preservedFacts,
    },
    commercial: {
      opportunityScore: result.opportunityScore,
      revenueScore: result.pricing.revenueScore,
      confidence: result.pricing.confidence,
      estimatedProfit: result.pricing.estimatedProfit,
      estimatedNetMarginPct: result.pricing.estimatedNetMarginPct,
    },
    policy: {
      publishRequiresHumanApproval: true,
      autonomousPurchaseAllowed: false,
    },
    warnings: [...result.warnings],
  };
}

export async function buildCommercialDraft(
  candidate: OpportunityCandidate,
  facts: CommercialFacts = {},
  useAi = true
): Promise<ProductDraft> {
  const result = evaluateOpportunity(candidate);
  if (result.status !== 'draft_ready') {
    throw new Error(`Candidate is ${result.status}; only draft_ready candidates may enter Draft Builder`);
  }

  const base = deterministicDraft(candidate, result, facts);
  if (!useAi) return base;

  const evidencePayload = {
    title: candidate.title,
    category: facts.category || null,
    description: facts.description || null,
    features: facts.features || [],
    specs: facts.specs || {},
    supplierName: facts.supplierName || null,
    shippingDaysMin: facts.shippingDaysMin ?? null,
    shippingDaysMax: facts.shippingDaysMax ?? null,
    warrantyText: facts.warrantyText || null,
  };

  const prompt = `
Eres el redactor comercial de Victoriosa. Transforma una ficha de producto en un borrador atractivo en español.
REGLAS ABSOLUTAS:
- No inventes materiales, medidas, certificaciones, garantía, disponibilidad, stock, país de origen, envío, reseñas, ratings, resultados médicos ni compatibilidades.
- Solo puedes afirmar datos presentes en EVIDENCIA.
- Puedes mejorar redacción, claridad, SEO y estructura comercial.
- Si falta un dato, omítelo.
- No cambies el precio ni ningún número económico.
- Devuelve JSON estricto con: title, subtitle, description, seoTitle, seoDescription, tags.

EVIDENCIA:
${JSON.stringify(evidencePayload)}
`;

  const enhanced = await aiStructuredCompletion<any>(prompt, null, 'structured_analysis');
  if (!enhanced || typeof enhanced !== 'object') {
    base.warnings.push('AI copy enhancement unavailable; deterministic draft retained.');
    return base;
  }

  return {
    ...base,
    title: compactText(enhanced.title) || base.title,
    subtitle: compactText(enhanced.subtitle) || base.subtitle,
    description: compactText(enhanced.description) || base.description,
    seoTitle: (compactText(enhanced.seoTitle) || base.seoTitle).slice(0, 60),
    seoDescription: (compactText(enhanced.seoDescription) || base.seoDescription).slice(0, 155),
    tags: Array.isArray(enhanced.tags)
      ? Array.from(new Set(enhanced.tags.map(compactText).filter(Boolean))).slice(0, 12)
      : base.tags,
    provenance: {
      ...base.provenance,
      generatedFields: ['title', 'subtitle', 'description', 'seoTitle', 'seoDescription', 'tags'],
    },
  };
}
