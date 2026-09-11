import { GoogleGenAI } from '@google/genai';

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
}

const VICTORIOSA_IDENTITY = `
Eres el Autopilot Central de Inteligencia de 'Victoriosa', una marca y plataforma e-commerce prémium, contemporánea y de alta confianza.
La identidad de Victoriosa se basa en:
1. Sofisticación sin pretensiones: diseño elegante, materiales prémium, ergonomía y practicidad cotidiana.
2. Tono de marca: Persuasivo, refinado, claro, transparente y enfocado en la experiencia del cliente (en español impecable).
3. Criterio de selección estricto: Solo productos con alto potencial, márgenes sanos (40-70%), proveedores confiables, bajo riesgo.
`;

export function calculatePricing(cost: number, shipping: number = 3.5, targetMarginPct: number = 55) {
  const totalCost = cost + shipping;
  const rawPrice = totalCost / (1 - targetMarginPct / 100);

  let roundedPrice = Math.ceil(rawPrice);
  if (roundedPrice > 20) {
    roundedPrice = roundedPrice - 0.05;
  } else {
    roundedPrice = Math.round(rawPrice * 2) / 2 - 0.05;
    if (roundedPrice < 9.95) roundedPrice = 9.95;
  }

  const compareAtPrice = +(roundedPrice * 1.35).toFixed(2);
  const margin = +(roundedPrice - totalCost).toFixed(2);
  const marginPct = +((margin / roundedPrice) * 100).toFixed(1);

  return {
    suggestedPrice: roundedPrice,
    compareAtPrice,
    margin,
    marginPct,
  };
}

export async function analyzeProduct(
  product: any,
  aiClient: GoogleGenAI | null
): Promise<ProductAnalysis | null> {
  if (!aiClient) return null;

  const cost = Number(product.costPrice || product.salePrice || 25);
  const shipping = Number(product.shippingCost || 3.5);
  const pricing = calculatePricing(cost, shipping, 55);

  const prompt = `
${VICTORIOSA_IDENTITY}

Analiza este producto de CJ Dropshipping para el catálogo de Victoriosa:

DATOS DEL PRODUCTO:
- Título original: ${product.productNameEn || product.productName || product.title}
- Categoría: ${product.categoryName || product.category || 'General'}
- Precio proveedor: $${product.salePrice || product.costPrice || cost}
- SKU: ${product.productSku || product.sku || 'N/A'}
- Peso: ${product.productWeight || 'N/A'}kg
- Stock: ${product.stockQuantity || 'N/A'}
- URL: ${product.productUrl || 'N/A'}
- Imagen: ${product.productImage || 'N/A'}

TAREAS:
1. Genera un título comercial prémium en español (máximo 8 palabras)
2. Genera subtítulo persuasivo
3. Genera descripción rica y elegante (2 párrafos)
4. Extrae 4-5 características clave
5. Genera especificaciones técnicas
6. Evalúa demanda, competencia, margen, calidad, logística (0-100)
7. Calcula score general (0-100) y tier (S/A/B/C/D)
8. Evalúa riesgos (copyright, claims, proveedor, devoluciones)
9. Sugiere badges de confianza

Devuelve SOLO JSON:
{
  "title": "...",
  "subtitle": "...",
  "description": "...",
  "category": "...",
  "tags": ["...", "..."],
  "features": ["...", "..."],
  "specs": { "Material": "...", "Dimensiones": "...", "Garantía": "3 Años Victoriosa" },
  "badges": ["...", "..."],
  "analysis": {
    "demandScore": 85,
    "competitionLevel": "medium",
    "marginPotential": 75,
    "brandFitScore": 90,
    "qualityScore": 80,
    "logisticsScore": 85,
    "overallScore": 85,
    "scoreTier": "A",
    "targetAudience": "...",
    "keySellingPoints": ["...", "...", "..."]
  },
  "risk": {
    "level": "low",
    "copyrightRisk": "none",
    "claimsRisk": "safe",
    "supplierRisk": "safe",
    "returnRisk": "low",
    "details": ["..."]
  }
}
`;

  try {
    const response = await aiClient.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const parsed = JSON.parse(response.text || '{}');

    return {
      title: parsed.title || product.productNameEn || 'Producto Victoriosa',
      subtitle: parsed.subtitle || '',
      description: parsed.description || '',
      category: parsed.category || product.categoryName || 'General',
      tags: parsed.tags || ['Prémium', 'Victoriosa'],
      features: parsed.features || [],
      specs: parsed.specs || {},
      badges: parsed.badges || ['Garantía Victoriosa 3 Años', 'Envío Express'],
      pricing,
      analysis: {
        demandScore: parsed.analysis?.demandScore || 75,
        competitionLevel: parsed.analysis?.competitionLevel || 'medium',
        marginPotential: parsed.analysis?.marginPotential || 70,
        brandFitScore: parsed.analysis?.brandFitScore || 80,
        qualityScore: parsed.analysis?.qualityScore || 75,
        logisticsScore: parsed.analysis?.logisticsScore || 80,
        overallScore: parsed.analysis?.overallScore || 80,
        scoreTier: parsed.analysis?.scoreTier || 'B',
        targetAudience: parsed.analysis?.targetAudience || 'Consumidor prémium',
        keySellingPoints: parsed.analysis?.keySellingPoints || [],
      },
      risk: {
        level: parsed.risk?.level || 'medium',
        copyrightRisk: parsed.risk?.copyrightRisk || 'low',
        claimsRisk: parsed.risk?.claimsRisk || 'safe',
        supplierRisk: parsed.risk?.supplierRisk || 'moderate',
        returnRisk: parsed.risk?.returnRisk || 'medium',
        details: parsed.risk?.details || [],
      },
    };
  } catch (err) {
    console.error('Gemini analysis error:', err);
    return null;
  }
}
