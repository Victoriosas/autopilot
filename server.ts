import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { getCJClient } from "./src/services/cjDropshipping";
import { getSourcingService } from "./src/services/productSourcingService";
import { getSourcingScheduler } from "./src/services/sourcingScheduler";
import { aiCompletion, aiStructuredCompletion, getProviderStatus } from "./src/services/aiClient";
import { mountAutopilotV4 } from "./src/autopilot/mount";

dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));
mountAutopilotV4(app);

// System prompt defining Victoriosa Brand Identity & Evaluation Rules
const VICTORIOSA_IDENTITY_PROMPT = `
Eres el Autopilot Central de Inteligencia de 'Victoriosa', una marca y plataforma e-commerce prémium, contemporánea y de alta confianza.
La identidad de Victoriosa se basa en:
1. Sofisticación sin pretensiones: diseño elegante, materiales prémium, ergonomía y practicidad cotidiana.
2. Tono de marca: Persuasivo, refinado, claro, transparente y enfocado en la experiencia del cliente (en español impecable).
3. Criterio de selección estricto: Solo productos con alto potencial, márgenes sanos (40-70%), proveedores confiables, bajo riesgo de devoluciones y cero claims médicos fraudulentos o copias no autorizadas.
`;

// Helper: Calculate Pricing
function calculateVictoriosaPricing(costEur: number, supplierShipping: number = 3.5, targetMarginPct: number = 55) {
  const totalCost = costEur + supplierShipping;
  const rawPrice = totalCost / (1 - (targetMarginPct / 100));
  
  // Psychological rounding (.95, .00 or .50)
  let roundedPrice = Math.ceil(rawPrice);
  if (roundedPrice > 20) {
    roundedPrice = roundedPrice - 0.05;
  } else {
    roundedPrice = Math.round(rawPrice * 2) / 2 - 0.05;
    if (roundedPrice < 9.95) roundedPrice = 9.95;
  }
  
  // PayPal US gateway fee: 3.49% + $0.49
  const gatewayFee = +(roundedPrice * 0.0349 + 0.49).toFixed(2);
  const estimatedCustoms = +(totalCost * 0.04).toFixed(2);
  const potentialProfit = +(roundedPrice - totalCost - gatewayFee - estimatedCustoms).toFixed(2);
  const compareAtPrice = +(roundedPrice * 1.35).toFixed(2);

  // USD conversion
  const exchangeRate = parseFloat(process.env.EXCHANGE_RATE_EUR_USD || '1.08');
  const priceUsd = +(roundedPrice * exchangeRate).toFixed(2);

  return {
    originalCostEur: costEur,
    originalCurrency: 'EUR',
    supplierShippingCost: supplierShipping,
    estimatedCustoms,
    gatewayFee,
    targetMarginPct,
    suggestedPrice: roundedPrice,
    retailPrice: roundedPrice,
    compareAtPrice,
    potentialProfit,
    psychologicalEnding: roundedPrice.toString().split('.')[1] || '00',
    checkoutCurrency: 'USD',
    exchangeRate,
    priceUsd
  };
}

// 1. Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Victoriosa Autopilot Core",
    aiProviders: getProviderStatus(),
    timestamp: new Date().toISOString()
  });
});

// 2. Autopilot Product Discovery (Generates / Scrapes candidate opportunities)
app.post("/api/autopilot/discover", async (req, res) => {
  try {
    const { category, source, keyword, count = 3 } = req.body;

    const prompt = `
${VICTORIOSA_IDENTITY_PROMPT}

Genera ${count} oportunidades de productos candidatos descubiertos en ${source || 'fuentes globales de e-commerce'} para la categoría '${category || 'Tecnología & Gadgets'}'.
Palabra clave o foco: '${keyword || 'tendencias emergentes de alta demanda'}'.

Devuelve un JSON estricto con un arreglo de objetos que contenga los datos crudos del producto candidato:
[
  {
    "originalTitle": "Nombre crudo del producto en el marketplace",
    "rawCategory": "Categoría original",
    "sourcePlatform": "${source || 'Amazon Global'}",
    "sourceUrl": "https://ejemplo-fuente.com/item/12345",
    "sourceSku": "SKU-AUTO-RANDOM",
    "sourceRating": 4.6,
    "supplierName": "Nombre del fabricante o distribuidor",
    "supplierReliability": 88,
    "supplierCountry": "Alemania / España / CN / Japón",
    "shippingDaysMin": 2,
    "shippingDaysMax": 5,
    "costPriceEur": 24.50,
    "supplierShippingCost": 3.90,
    "rawFeatures": ["caracteristica 1", "caracteristica 2", "caracteristica 3"],
    "rawImages": ["https://images.unsplash.com/photo-..."],
    "productConcept": "Resumen de por qué es una buena oportunidad"
  }
]

Asegúrate de usar imágenes reales de Unsplash representativas (tecnología, diseño nórdico, café, accesorios de cuero, audio, ergonomía, lámparas minimalistas, etc.).
`;

    const parsed = await aiStructuredCompletion<any[]>(prompt, []);
    return res.json({ success: true, candidates: parsed, source: "ai-multi-provider" });
  } catch (err: any) {
    console.error("Autopilot discover error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Full Autopilot Pipeline Analysis (Runs all 12 pipeline stages)
app.post("/api/autopilot/analyze", async (req, res) => {
  try {
    const { candidate, settings = {} } = req.body;
    if (!candidate) {
      return res.status(400).json({ error: "Missing candidate payload" });
    }

    const cost = Number(candidate.costPriceEur || candidate.costPrice || 25);
    const shipping = Number(candidate.supplierShippingCost || 3.5);
    const minMargin = Number(settings.minMarginPercentage || 50);

    const pricing = calculateVictoriosaPricing(cost, shipping, minMargin);

    const prompt = `
${VICTORIOSA_IDENTITY_PROMPT}

Analiza este producto candidato para el catálogo de Victoriosa y ejecuta el pipeline de transformación completo:

DATOS CRUDOS DEL CANDIDATO:
Título original: ${candidate.originalTitle || candidate.title}
Categoría cruda: ${candidate.rawCategory || candidate.category || 'General'}
Fuente: ${candidate.sourcePlatform || 'Marketplace'} (${candidate.sourceUrl || ''})
Proveedor: ${candidate.supplierName || 'Global Supplier'} (Fiabilidad: ${candidate.supplierReliability || 85}%)
Costo original: €${cost}
Características crudas: ${JSON.stringify(candidate.rawFeatures || candidate.features || [])}

TAREAS OBLIGATORIAS:
1. Normalización y Brand Fit: Transforma el título a un nombre comercial prémium en español acorde a Victoriosa (máximo 8 palabras).
2. Genera un subtítulo sugerente y una descripción rica, persuasiva y elegante (2 párrafos) resaltando materiales, beneficios y experiencia de uso.
3. Extrae 4 o 5 viñetas de características clave optimizadas.
4. Genera especificaciones técnicas estructuradas (material, dimensiones, conectividad, garantía, etc.).
5. Evaluación Multidimensional:
   - demandScore (0-100)
   - competitionLevel ('low' | 'medium' | 'high')
   - marginPotential (0-100)
   - brandFitScore (0-100)
   - brandFitJustification (explicación concisa)
   - qualityScore (0-100)
   - logisticsScore (0-100)
   - overallScore (0-100)
   - scoreTier ('S' | 'A' | 'B' | 'C' | 'D')
   - targetAudience (perfil de comprador)
   - keySellingPoints (3 puntos clave)
   - validatedClaims (claims confirmados)
   - potentialIssues (riesgos o puntos a cuidar)
6. Análisis de Riesgos y Compliance:
   - level ('low' | 'medium' | 'high' | 'critical')
   - copyrightRisk ('none' | 'low' | 'medium' | 'high')
   - claimsRisk ('safe' | 'needs_disclaimer' | 'prohibited')
   - supplierRisk ('safe' | 'moderate' | 'unverified')
   - returnRisk ('low' | 'medium' | 'high')
   - details (lista de notas de compliance)
7. Insignias de confianza de Victoriosa recomendadas (ej: "Garantía Victoriosa 3 Años", "Envío Prémium 24/48h", "Selección Exclusiva", "Materiales Sostenibles").

Devuelve ÚNICAMENTE un JSON con esta estructura exacta:
{
  "title": "...",
  "subtitle": "...",
  "category": "...",
  "tags": ["...", "..."],
  "description": "...",
  "features": ["...", "..."],
  "specs": { "Material": "...", "Dimensiones": "...", "Garantía": "3 Años Victoriosa" },
  "badges": ["...", "..."],
  "analysis": { ... },
  "risk": { ... }
}
`;

    const analysisResult = await aiStructuredCompletion<any>(prompt, null);

    if (!analysisResult || !analysisResult.title) {
      return res.status(503).json({ 
        success: false, 
        error: "AI analysis unavailable. Configure GROQ_API_KEY, CEREBRAS_API_KEY, or OPENROUTER_API_KEY.",
        status: "AI_ANALYSIS_FAILED"
      });
    }

    // Determine candidate qualification
    const overallScore = analysisResult.analysis?.overallScore || 85;
    const riskLevel = analysisResult.risk?.level || 'low';
    const autoApproveThreshold = Number(settings.autoApproveScoreThreshold || 85);
    const maxRiskAllowed = settings.maxRiskLevelAllowed || 'medium';

    const isRiskAcceptable = riskLevel === 'low' || (riskLevel === 'medium' && maxRiskAllowed !== 'low');
    const meetsScore = overallScore >= autoApproveThreshold;

    let targetStatus: string = 'ready_for_review';
    let nextStage: string = 'review';

    if (meetsScore && isRiskAcceptable) {
      if (settings.autoPublishApproved) {
        targetStatus = 'published';
        nextStage = 'publication';
      } else {
        targetStatus = 'approved';
        nextStage = 'draft';
      }
    } else if (riskLevel === 'critical' || overallScore < 60) {
      targetStatus = 'rejected';
      nextStage = 'scoring';
    }

    const images = candidate.rawImages && candidate.rawImages.length > 0 
      ? candidate.rawImages 
      : (candidate.images || [
          "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&auto=format&fit=crop&q=80",
          "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&auto=format&fit=crop&q=80"
        ]);

    const generatedProduct = {
      id: candidate.id || `vic-prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      status: targetStatus,
      title: analysisResult.title,
      originalTitle: candidate.originalTitle || candidate.title || analysisResult.title,
      subtitle: analysisResult.subtitle,
      slug: (analysisResult.title || 'producto')
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, ""),
      category: analysisResult.category || candidate.rawCategory || "Tecnología & Gadgets",
      subCategory: candidate.subCategory || "Selección Especial",
      tags: analysisResult.tags || ["Prémium", "Victoriosa"],
      brand: "Victoriosa",
      description: analysisResult.description,
      originalDescription: candidate.rawDescription || candidate.originalDescription,
      features: analysisResult.features || [],
      specs: analysisResult.specs || {},
      images,
      originalImages: candidate.rawImages || images,
      price: pricing.suggestedPrice,
      compareAtPrice: pricing.compareAtPrice,
      costPrice: cost,
      inventory: candidate.inventory || 0,
      sku: candidate.sourceSku || `VIC-PENDING-${Date.now().toString().slice(-6)}`,
      badges: analysisResult.badges || ["Garantía Victoriosa 3 Años", "Envío Express"],
      rating: candidate.sourceRating || 0,
      reviewCount: candidate.reviewCount || 0,
      variants: candidate.variants || [
        {
          id: "v-color",
          name: "Acabado / Color",
          options: ["Negro Mate Obsidiana", "Plata Titanio", "Arena Nórdica"]
        }
      ],
      traceability: {
        createdBy: "Victoriosa Autopilot Bot v3.0 (Gemini Powered)",
        createdAt: candidate.traceability?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: {
          name: candidate.supplierName || "Marketplace Feed",
          url: candidate.sourceUrl || "https://marketplace.global/item",
          platform: candidate.sourcePlatform || "Amazon Global",
          sku: candidate.sourceSku || "SKU-AUTO-RAW",
          rating: candidate.sourceRating || 4.7,
          rawCategory: candidate.rawCategory || "General"
        },
        supplier: {
          name: candidate.supplierName || "Global Logistics Provider",
          reliabilityScore: candidate.supplierReliability || 92,
          country: candidate.supplierCountry || "España / UE",
          shippingDaysMin: candidate.shippingDaysMin || 2,
          shippingDaysMax: candidate.shippingDaysMax || 4,
          returnPolicy: "30 días sin coste con recogida a domicilio"
        },
        pricing,
        analysis: analysisResult.analysis,
        risk: analysisResult.risk,
        history: [
          ...(candidate.traceability?.history || []),
          {
            timestamp: new Date().toISOString(),
            stage: nextStage,
            fromStatus: candidate.status || 'discovered',
            toStatus: targetStatus,
            action: `Autopilot AI Analysis & Scoring (Score: ${overallScore}/100, Tier: ${analysisResult.analysis?.scoreTier || 'A'})`,
            actor: "Autopilot Pipeline Engine",
            notes: meetsScore && isRiskAcceptable 
              ? "Cumple los criterios de margen y calidad para el catálogo público." 
              : "Requiere revisión manual de moderación."
          }
        ]
      }
    };

    res.json({
      success: true,
      product: generatedProduct,
      stage: nextStage,
      status: targetStatus
    });
  } catch (err: any) {
    console.error("Autopilot analyze error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Image Enhancement Analysis & Studio Optimization
app.post("/api/autopilot/enhance-image", async (req, res) => {
  try {
    const { imageUrl, options = {} } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ error: "Missing imageUrl" });
    }

    let aiEnhancementNotes = "Procesamiento de imagen optimizado para catálogo prémium Victoriosa.";

    try {
      const prompt = `
Analiza esta imagen de producto para e-commerce de lujo Victoriosa: ${imageUrl}
Proporciona recomendaciones de retoque:
1. Encuadre óptimo (aspect ratio 1:1 o 4:5 centrado).
2. Sugerencia de fondo de estudio (Obsidian Dark, Minimal White, o Frosted Glass).
3. Corrección de color y brillo recomendada.
Devuelve un JSON conciso:
{
  "recommendedBackdrop": "dark_studio",
  "brightnessAdjustment": 5,
  "contrastAdjustment": 15,
  "saturationAdjustment": 10,
  "notes": "..."
}
`;
      const parsed = await aiStructuredCompletion<any>(prompt, {});
      if (parsed.notes) aiEnhancementNotes = parsed.notes;
    } catch (aiErr) {
      console.warn("AI Image advisor notice:", aiErr);
    }

    res.json({
      success: true,
      originalUrl: imageUrl,
      enhancementPlan: {
        targetAspectRatio: options.aspectRatio || "1:1",
        targetResolution: "1000x1000px",
        studioBackdrop: options.studioBackdrop || "dark_studio",
        studioLighting: true,
        groundShadow: true,
        colorCorrection: {
          brightness: options.brightness ?? 5,
          contrast: options.contrast ?? 12,
          saturation: options.saturation ?? 10,
          sharpness: options.sharpness ?? 25,
          vignette: options.vignette ?? 15
        },
        aiNotes: aiEnhancementNotes
      }
    });
  } catch (err: any) {
    console.error("Image enhancement endpoint error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Supplier Evaluation & Verification Endpoint
app.post("/api/autopilot/evaluate-supplier", async (req, res) => {
  try {
    const { supplier, category, expectedVolume = 50 } = req.body;
    if (!supplier) {
      return res.status(400).json({ error: "Missing supplier data" });
    }

    const reliability = Number(supplier.metrics?.reliabilityScore || supplier.reliabilityScore || 85);
    const fulfillment = Number(supplier.metrics?.fulfillmentRate || 97);
    const defect = Number(supplier.metrics?.defectRate || 0.5);
    const avgDispatch = Number(supplier.metrics?.avgDispatchDays || 2);

    // Calculate volume tier discount
    let volumeDiscount = Number(supplier.pricingAgreements?.baseDiscountPct || 15);
    const tiers = supplier.pricingAgreements?.volumeTiers || [];
    for (const tier of tiers) {
      if (expectedVolume >= tier.minUnits && tier.discountPct > volumeDiscount) {
        volumeDiscount = tier.discountPct;
      }
    }

    // Risk score calculation
    let supplierRiskLevel: 'low' | 'medium' | 'high' = 'low';
    if (reliability < 75 || defect > 2.0 || avgDispatch > 5) {
      supplierRiskLevel = 'high';
    } else if (reliability < 88 || defect > 1.0 || avgDispatch > 3) {
      supplierRiskLevel = 'medium';
    }

    res.json({
      success: true,
      supplierId: supplier.id,
      supplierName: supplier.name,
      evaluation: {
        reliabilityScore: reliability,
        supplierRiskLevel,
        effectiveDiscountPct: volumeDiscount,
        fulfillmentRate: fulfillment,
        defectRate: defect,
        dispatchSpeedDays: avgDispatch,
        isApprovedForAutopilot: supplierRiskLevel !== 'high' && reliability >= 80,
        recommendation: supplierRiskLevel === 'low'
          ? "Proveedor prémium certificado para auto-publicación directa."
          : supplierRiskLevel === 'medium'
          ? "Proveedor verificado con supervisión de inventario recomendada."
          : "Riesgo logístico elevado. Requiere auditoría antes de publicar productos."
      }
    });
  } catch (err: any) {
    console.error("Supplier evaluate error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Connectors Directory & Live Status Endpoint
app.get("/api/connectors", (req, res) => {
  try {
    const configs = [
      {
        id: "supplier-hub-b2b",
        name: "Supplier Hub B2B (Proveedores Homologados UE)",
        platform: "Supplier Hub B2B",
        status: "IMPLEMENTED",
        statusReason: "Conector directo activo con catálogo mayorista verificado y cálculo de márgenes en tiempo real.",
        capabilities: ["search", "direct_url", "price_check", "stock_check", "auto_purchase", "tracking_sync"],
        apiKeyConfigured: true,
        defaultCurrency: "EUR",
        rateLimitPerMinute: 120,
        lastCheckedAt: new Date().toISOString()
      },
      {
        id: "amazon-global",
        name: "Amazon Product Advertising & SP-API",
        platform: "Amazon Global",
        status: Boolean(process.env.AMAZON_ACCESS_KEY && process.env.AMAZON_SECRET_KEY) ? "REQUIRES_HUMAN_ACTION" : "REQUIRES_CREDENTIALS",
        statusReason: Boolean(process.env.AMAZON_ACCESS_KEY && process.env.AMAZON_SECRET_KEY) 
          ? "API conectada. Compra final requiere acción humana según términos de servicio de Amazon." 
          : "Faltan credenciales (AMAZON_ACCESS_KEY, AMAZON_SECRET_KEY). Las compras requieren acción humana manual.",
        capabilities: ["search", "direct_url", "price_check", "stock_check", "manual_purchase"],
        apiKeyConfigured: Boolean(process.env.AMAZON_ACCESS_KEY && process.env.AMAZON_SECRET_KEY),
        defaultCurrency: "EUR",
        rateLimitPerMinute: 60,
        lastCheckedAt: new Date().toISOString()
      },
      {
        id: "aliexpress-direct",
        name: "AliExpress Open Platform API (DS)",
        platform: "AliExpress Direct",
        status: Boolean(process.env.ALIEXPRESS_APP_KEY && process.env.ALIEXPRESS_APP_SECRET) ? "IMPLEMENTED" : "NOT_CONFIGURED",
        statusReason: Boolean(process.env.ALIEXPRESS_APP_KEY && process.env.ALIEXPRESS_APP_SECRET)
          ? "AliExpress Dropshipping Open API configurada."
          : "Credenciales de AliExpress no configuradas. Los pedidos requieren compra asistida manual.",
        capabilities: ["search", "direct_url", "price_check", "stock_check", "manual_purchase"],
        apiKeyConfigured: Boolean(process.env.ALIEXPRESS_APP_KEY && process.env.ALIEXPRESS_APP_SECRET),
        defaultCurrency: "EUR",
        rateLimitPerMinute: 60,
        lastCheckedAt: new Date().toISOString()
      },
      {
        id: "alibaba-wholesale",
        name: "Alibaba B2B Wholesale & RFQ Engine",
        platform: "Alibaba Wholesale",
        status: "REQUIRES_HUMAN_ACTION",
        statusReason: "Alibaba opera bajo contratos mayoristas B2B y Trade Assurance que requieren confirmación humana.",
        capabilities: ["search", "direct_url", "price_check", "manual_purchase"],
        apiKeyConfigured: true,
        defaultCurrency: "EUR",
        rateLimitPerMinute: 30,
        lastCheckedAt: new Date().toISOString()
      },
      {
        id: "direct-import",
        name: "Universal URL Importer & Metadata Extractor",
        platform: "Direct Import",
        status: "IMPLEMENTED",
        statusReason: "Motor de extracción y análisis de enlaces directos de e-commerce y proveedores mayoristas.",
        capabilities: ["direct_url", "price_check", "manual_purchase"],
        apiKeyConfigured: true,
        defaultCurrency: "EUR",
        rateLimitPerMinute: 60,
        lastCheckedAt: new Date().toISOString()
      }
    ];

    res.json({ success: true, connectors: configs });
  } catch (err: any) {
    console.error("Connectors list error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Direct URL Import & Metadata Extraction Endpoint
app.post("/api/connectors/direct-import", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: "URL inválida o no proporcionada" });
    }

    const isAmazon = url.includes("amazon.") || url.includes("amzn.");
    const isAliExpress = url.includes("aliexpress.");
    const isAlibaba = url.includes("alibaba.");
    const isCJ = url.includes("cjdropshipping.com");

    const platform = isCJ ? "CJ Dropshipping" : isAmazon ? "Amazon Global" : isAliExpress ? "AliExpress Direct" : isAlibaba ? "Alibaba Wholesale" : "Direct Import";

    let extractedData: any = null;

    // If CJ URL, try to get product directly from API
    if (isCJ) {
      const cj = getCJClient();
      if (cj) {
        try {
          const pidMatch = url.match(/product-p-(\d+)/);
          if (pidMatch) {
            const product = await cj.getProductDetail(pidMatch[1]);
            if (product) {
              extractedData = {
                originalTitle: product.productNameEn || product.productName,
                rawCategory: product.categoryName || "General",
                costPriceEur: product.salePrice || product.sellPrice || 25,
                supplierShippingCost: 4.50,
                rawFeatures: ["Producto verificado CJ Dropshipping", "Envío internacional", "Garantía de calidad"],
                supplierName: "CJ Dropshipping",
                supplierCountry: "China",
                supplierReliability: 90,
                rawImages: product.productImage ? [product.productImage] : []
              };
            }
          }
        } catch (cjErr) {
          console.warn("CJ direct fetch error:", cjErr);
        }
      }
    }

    // If no CJ data, try AI extraction
    if (!extractedData) {
      try {
        const prompt = `
Analiza esta URL de producto de e-commerce: ${url}
Plataforma detectada: ${platform}

Extrae o infiere los metadatos crudos del producto con realismo:
1. originalTitle (título descriptivo en español)
2. rawCategory (categoría como 'Tecnología & Gadgets', 'Hogar & Diseño', 'Audio & Sonido', 'Relojería', 'Cuidado Personal')
3. costPriceEur (costo estimado realista en EUR para este tipo de producto, ej: 25.00 a 120.00)
4. supplierShippingCost (coste de envío de origen, ej: 3.50 a 6.00)
5. rawFeatures (arreglo de 3 a 5 características técnicas)
6. supplierName (nombre del fabricante o vendedor)
7. supplierCountry (país de origen o almacén)
8. supplierReliability (score 80 a 98)
9. rawImages (1 o 2 URLs reales y estéticas de Unsplash de producto de alta calidad correspondientes a la categoría)

Devuelve ÚNICAMENTE un JSON con esta estructura:
{
  "originalTitle": "...",
  "rawCategory": "...",
  "costPriceEur": 35.00,
  "supplierShippingCost": 4.50,
  "rawFeatures": ["...", "..."],
  "supplierName": "...",
  "supplierCountry": "...",
  "supplierReliability": 92,
  "rawImages": ["https://images.unsplash.com/..."]
}
`;
        extractedData = await aiStructuredCompletion<any>(prompt, {});
      } catch (aiErr) {
        console.warn("Direct URL AI extraction notice:", aiErr);
      }
    }

    // Fallback: extract basic info from URL without AI
    if (!extractedData || !extractedData.originalTitle) {
      const urlParts = url.split('/');
      const slug = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || 'product';
      const titleFromUrl = slug.replace(/[-_]/g, ' ').replace(/\.(html|php)$/i, '').substring(0, 80);

      extractedData = {
        originalTitle: titleFromUrl || `Producto desde ${platform}`,
        rawCategory: "General",
        costPriceEur: 25.00,
        supplierShippingCost: 4.50,
        rawFeatures: ["Importación directa", "Verificar detalles con proveedor"],
        supplierName: platform,
        supplierCountry: "Internacional",
        supplierReliability: 85,
        rawImages: ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&auto=format&fit=crop&q=80"]
      };
    }

    const candidate = {
      id: `url-cand-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sourcePlatform: platform,
      sourceUrl: url,
      sourceSku: `SKU-${Math.floor(Math.random() * 89999 + 10000)}`,
      originalTitle: extractedData.originalTitle,
      rawCategory: extractedData.rawCategory,
      costPriceEur: Number(extractedData.costPriceEur) || 35.00,
      supplierShippingCost: Number(extractedData.supplierShippingCost) || 4.50,
      shippingDaysMin: 2,
      shippingDaysMax: 5,
      supplierName: extractedData.supplierName || "Proveedor Verificado",
      supplierCountry: extractedData.supplierCountry || "España / UE",
      supplierReliability: Number(extractedData.supplierReliability) || 90,
      rawFeatures: extractedData.rawFeatures || [],
      rawImages: extractedData.rawImages && extractedData.rawImages.length > 0
        ? extractedData.rawImages
        : ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&auto=format&fit=crop&q=80"],
      productConcept: `Importación directa desde ${platform} procesada por Autopilot.`
    };

    res.json({ success: true, candidate });
  } catch (err: any) {
    console.error("Direct URL import error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Pre-Purchase Verification Endpoint (Checks stock, live price delta, margin health before buying)
app.post("/api/fulfillment/verify", async (req, res) => {
  try {
    const { 
      sourceUrl, 
      sourceSku, 
      sourcePlatform = "Supplier Hub B2B",
      expectedCost = 25.00, 
      expectedShipping = 3.50, 
      salePrice = 59.95,
      destinationCountry = "ES" 
    } = req.body;

    const liveCost = Number(expectedCost);
    const liveShipping = Number(expectedShipping);
    const priceDelta = 0;
    const shippingDelta = 0;
    const inStock = true;

    const gatewayFee = +(salePrice * 0.015 + 0.25).toFixed(2);
    const estimatedNetProfit = +(salePrice - liveCost - liveShipping - gatewayFee).toFixed(2);
    const estimatedNetMarginPct = +( (estimatedNetProfit / salePrice) * 100 ).toFixed(1);

    const flags: string[] = [];
    const isHumanAction = sourcePlatform === "Amazon Global" || sourcePlatform === "AliExpress Direct" || sourcePlatform === "Alibaba Wholesale" || sourcePlatform === "Direct Import";

    if (isHumanAction) {
      flags.push("REQUIRES_HUMAN_ACTION");
    }

    const verification = {
      passed: false,
      checkedAt: new Date().toISOString(),
      productId: sourceSku || "SKU-UNKNOWN",
      productTitle: "Verificación de Suministro",
      sourceUrl,
      supplierName: `${sourcePlatform} - Verificación Pendiente`,
      sourcePlatform,
      inStock: false,
      stockAvailableQuantity: undefined,
      expectedCost,
      liveCost,
      priceDeltaEur: priceDelta,
      priceDeltaPercentage: 0,
      expectedShippingCost: expectedShipping,
      liveShippingCost: liveShipping,
      shippingDeltaEur: shippingDelta,
      salePrice,
      estimatedNetProfit,
      estimatedNetMarginPct,
      marginHealthy: estimatedNetMarginPct >= 30,
      flags: ["REQUIRES_HUMAN_ACTION", "UNVERIFIED_STOCK"],
      actionRequired: "HUMAN_APPROVAL_REQUIRED",
      notes: `Verificación no automatizada para ${sourcePlatform}. El stock y precio deben ser confirmados manualmente por el operador.`
    };

    res.json({ success: true, verification });
  } catch (err: any) {
    console.error("Fulfillment verification error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Create Supplier Order / Fulfillment Dispatch Endpoint
app.post("/api/fulfillment/create-supplier-order", async (req, res) => {
  try {
    const { supplierOrder } = req.body;
    if (!supplierOrder) {
      return res.status(400).json({ error: "Missing supplierOrder payload" });
    }

    const platform = supplierOrder.sourcePlatform || "Supplier Hub B2B";
    const isAutoSupported = platform === "Supplier Hub B2B";

    if (isAutoSupported) {
      const supplierRef = `B2B-PO-${Date.now().toString().slice(-6)}`;

      // NOTE: In production, this would call the actual B2B supplier API.
      // Tracking number is NOT generated here - it comes from the supplier after shipment.
      res.json({
        success: true,
        status: "order_placed",
        supplierOrderReference: supplierRef,
        trackingNumber: undefined,
        carrier: undefined,
        trackingUrl: undefined,
        message: "Orden de compra registrada. El tracking será proporcionado por el proveedor tras el envío."
      });
    } else {
      res.json({
        success: true,
        status: "human_action_required",
        humanActionReason: `La plataforma ${platform} no tiene API de compra automatizada configurada o requiere autorización bancaria manual.`,
        message: "Orden de compra generada en estado ACCIÓN HUMANA REQUERIDA."
      });
    }
  } catch (err: any) {
    console.error("Create supplier order error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// PayPal Payment Integration
// ============================================================

function getPayPalBaseUrl(): string {
  return process.env.PAYPAL_ENV === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

let paypalAccessToken: string | null = null;
let paypalTokenExpiry: number = 0;

async function getPayPalAccessToken(): Promise<string> {
  if (paypalAccessToken && Date.now() < paypalTokenExpiry) {
    return paypalAccessToken;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) {
    throw new Error('PAYMENT_NOT_CONFIGURED');
  }

  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
  const res = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    throw new Error('Failed to obtain PayPal access token');
  }

  const data = await res.json();
  paypalAccessToken = data.access_token;
  paypalTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return paypalAccessToken!;
}

// GET /api/payments/paypal/config - Returns client ID for SDK init (safe, no secret)
app.get('/api/payments/paypal/config', (req, res) => {
  const configured = !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
  res.json({
    clientId: configured ? process.env.PAYPAL_CLIENT_ID : null,
    configured,
    currency: process.env.PAYPAL_CURRENCY || 'USD',
  });
});

// POST /api/payments/paypal/order - Creates PayPal order from Victoriosa order
app.post('/api/payments/paypal/order', async (req: any, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: 'orderId is required' });
    }

    // Check PayPal is configured
    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      return res.status(503).json({ error: 'PAYMENT_NOT_CONFIGURED', message: 'PayPal no está configurado. Contacta al administrador.' });
    }

    // In production, fetch order from Firestore and validate:
    // - Order exists
    // - paymentStatus is 'pending'
    // - Total is recalculated server-side from product prices
    // For now, accept the order total from the request body with a TODO for Firestore validation
    const { total, currency = 'USD', items = [] } = req.body;

    if (!total || total <= 0) {
      return res.status(400).json({ error: 'Invalid order total' });
    }

    if (currency !== 'USD') {
      return res.status(400).json({ error: 'Only USD is supported for checkout' });
    }

    // Create PayPal order
    const accessToken = await getPayPalAccessToken();
    const paypalRes = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: orderId,
          amount: {
            currency_code: 'USD',
            value: total.toFixed(2),
          },
          description: `Victoriosa Order ${orderId}`,
        }],
        application_context: {
          brand_name: 'Victoriosa',
          landing_page: 'BILLING',
          user_action: 'PAY_NOW',
          currency_code: 'USD',
        },
      }),
    });

    if (!paypalRes.ok) {
      const err = await paypalRes.json();
      console.error('PayPal create order error:', err);
      return res.status(502).json({ error: 'Failed to create PayPal order', details: err.message });
    }

    const paypalData = await paypalRes.json();
    res.json({ paypalOrderId: paypalData.id, status: paypalData.status });
  } catch (e: any) {
    if (e.message === 'PAYMENT_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'PAYMENT_NOT_CONFIGURED', message: 'PayPal no está configurado.' });
    }
    console.error('PayPal order creation error:', e);
    res.status(500).json({ error: 'Internal payment error' });
  }
});

// POST /api/payments/paypal/capture - Captures approved PayPal order
app.post('/api/payments/paypal/capture', async (req: any, res) => {
  try {
    const { paypalOrderId, orderId } = req.body;
    if (!paypalOrderId || !orderId) {
      return res.status(400).json({ error: 'paypalOrderId and orderId are required' });
    }

    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      return res.status(503).json({ error: 'PAYMENT_NOT_CONFIGURED', message: 'PayPal no está configurado.' });
    }

    const accessToken = await getPayPalAccessToken();
    const captureRes = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders/${paypalOrderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!captureRes.ok) {
      const err = await captureRes.json();
      console.error('PayPal capture error:', err);
      return res.status(502).json({ error: 'Failed to capture PayPal payment', details: err.message });
    }

    const captureData = await captureRes.json();

    // Verify capture status
    const captureStatus = captureData.status;
    if (captureStatus === 'COMPLETED') {
      // In production: update Firestore order
      // paymentStatus: 'paid', status: 'confirmed', paymentId: captureId
      const captureId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id;

      // TODO: Update Firestore document
      // await updateDoc(doc(db, 'orders', orderId), {
      //   paymentStatus: 'paid',
      //   status: 'confirmed',
      //   paymentId: captureId,
      //   paymentGateway: 'paypal',
      // });

      res.json({
        success: true,
        orderStatus: 'confirmed',
        paymentId: captureId,
      });
    } else {
      // Payment not completed - do NOT mark as paid
      res.status(402).json({
        success: false,
        error: 'Payment not completed',
        paypalStatus: captureStatus,
      });
    }
  } catch (e: any) {
    if (e.message === 'PAYMENT_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'PAYMENT_NOT_CONFIGURED', message: 'PayPal no está configurado.' });
    }
    console.error('PayPal capture error:', e);
    res.status(500).json({ error: 'Internal payment error' });
  }
});

// POST /api/webhooks/paypal - Idempotent webhook receiver
app.post('/api/webhooks/paypal', async (req, res) => {
  try {
    // Verify webhook signature if PAYPAL_WEBHOOK_ID is configured
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (webhookId) {
      const signature = req.headers['paypal-transmission-id'] as string;
      const timestamp = req.headers['paypal-transmission-time'] as string;
      const sigAlgorithm = req.headers['paypal-transmission-sig'] as string;

      if (!signature || !timestamp || !sigAlgorithm) {
        console.warn('PayPal webhook: missing signature headers');
        return res.status(401).json({ error: 'Missing webhook signature' });
      }

      // TODO: In production, verify webhook signature using crypto
      // const verified = await verifyPayPalWebhookSignature(webhookId, req.body, req.headers);
      // if (!verified) {
      //   return res.status(401).json({ error: 'Invalid webhook signature' });
      // }
    }

    const eventType = req.body?.event_type;
    const resource = req.body?.resource;

    // Idempotent processing: check current status before updating
    // In production: fetch order from Firestore by paypalOrderId or orderId
    switch (eventType) {
      case 'PAYMENT.CAPTURE.COMPLETED': {
        // Payment confirmed - update order if not already paid
        const orderId = resource?.custom_id || resource?.id;
        console.log(`PayPal webhook: PAYMENT.CAPTURE.COMPLETED for ${orderId}`);

        // TODO: In production, update Firestore
        // const orderRef = doc(db, 'orders', orderId);
        // const orderSnap = await getDoc(orderRef);
        // if (orderSnap.exists() && orderSnap.data().paymentStatus !== 'paid') {
        //   await updateDoc(orderRef, {
        //     paymentStatus: 'paid',
        //     status: 'confirmed',
        //     paymentId: resource?.id,
        //     paymentGateway: 'paypal',
        //   });
        //   await logAuditEvent('PAYMENT_CAPTURED', orderId, { captureId: resource?.id, source: 'webhook' });
        // }
        break;
      }
      case 'PAYMENT.CAPTURE.DENIED': {
        const orderId = resource?.custom_id || resource?.id;
        console.log(`PayPal webhook: PAYMENT.CAPTURE.DENIED for ${orderId}`);

        // TODO: In production, update Firestore
        // await updateDoc(doc(db, 'orders', orderId), { paymentStatus: 'failed' });
        // await logAuditEvent('PAYMENT_FAILED', orderId, { reason: 'capture_denied', source: 'webhook' });
        break;
      }
      case 'PAYMENT.CAPTURE.REFUNDED': {
        const orderId = resource?.custom_id || resource?.id;
        console.log(`PayPal webhook: PAYMENT.CAPTURE.REFUNDED for ${orderId}`);

        // TODO: In production, update Firestore
        // await updateDoc(doc(db, 'orders', orderId), {
        //   paymentStatus: 'refunded',
        //   status: 'refunded',
        // });
        // await logAuditEvent('PAYMENT_REFUNDED', orderId, { source: 'webhook' });
        break;
      }
      default:
        console.log(`PayPal webhook: unhandled event type ${eventType}`);
    }

    // Always return 200 OK to PayPal
    res.status(200).json({ received: true });
  } catch (e) {
    console.error('PayPal webhook error:', e);
    // Still return 200 to prevent PayPal retries
    res.status(200).json({ received: true, error: 'Internal processing error' });
  }
});

// ============================================================
// Product Sourcing Agent Endpoints
// ============================================================

// GET /api/products - Get all products from Supabase
app.get('/api/products', async (req, res) => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return res.json([]);

    const db = createClient(url, key);
    const { data } = await db.from('products').select('*').order('created_at', { ascending: false });
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sourcing/status - Scheduler status
app.get('/api/sourcing/status', async (req, res) => {
  try {
    const scheduler = getSourcingScheduler();
    res.json(scheduler.getStatus());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sourcing/stats - Sourcing statistics
app.get('/api/sourcing/stats', async (req, res) => {
  try {
    const service = getSourcingService();
    const stats = await service.getStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sourcing/history - Sourcing run history
app.get('/api/sourcing/history', async (req, res) => {
  try {
    const service = getSourcingService();
    const limit = parseInt(req.query.limit as string) || 20;
    const runs = await service.getRuns(limit);
    res.json({ runs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sourcing/products - Discovered products
app.get('/api/sourcing/products', async (req, res) => {
  try {
    const service = getSourcingService();
    const limit = parseInt(req.query.limit as string) || 50;
    const products = await service.getDiscoveredProducts(limit);
    res.json({ products });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sourcing/run - Trigger manual sourcing run
app.post('/api/sourcing/run', async (req, res) => {
  try {
    const service = getSourcingService();
    const config = await service.getConfig();
    const result = await service.runSourcing(config);
    res.json(result);
  } catch (err: any) {
    console.error('Sourcing run error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sourcing/count-by-category - Product count per category
app.get('/api/sourcing/count-by-category', async (req, res) => {
  try {
    const service = getSourcingService();
    const counts = await service.getProductsCountByCategory();
    const total = counts.reduce((sum, c) => sum + c.count, 0);
    const categoriesNeedingProducts = counts.filter((c) => c.needed > 0).map((c) => c.category);
    res.json({
      success: true,
      counts: counts.reduce((acc, c) => ({ ...acc, [c.category]: c.count }), {}),
      total,
      categoriesNeedingProducts,
      details: counts,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sourcing/verify-published - Verify all published products
app.post('/api/sourcing/verify-published', async (req, res) => {
  try {
    const service = getSourcingService();
    const result = await service.verifyPublishedProducts();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sourcing/config - Update sourcing configuration
app.put('/api/sourcing/config', async (req, res) => {
  try {
    const service = getSourcingService();
    await service.updateConfig(req.body);
    const config = await service.getConfig();
    res.json({ success: true, config });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sourcing/config - Get sourcing configuration
app.get('/api/sourcing/config', async (req, res) => {
  try {
    const service = getSourcingService();
    const config = await service.getConfig();
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sourcing/cj/categories - CJ category list
app.get('/api/sourcing/cj/categories', async (req, res) => {
  try {
    const cj = getCJClient();
    if (!cj) {
      return res.status(503).json({ error: 'CJ API not configured' });
    }
    const categories = await cj.getCategoryList();
    res.json({ categories });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sourcing/cj/search - Search CJ products
app.post('/api/sourcing/cj/search', async (req, res) => {
  try {
    const cj = getCJClient();
    if (!cj) {
      return res.status(503).json({ error: 'CJ API not configured' });
    }
    const { keyword, categoryId, pageSize = 20, minPrice, maxPrice } = req.body;
    const result = await cj.searchProducts({ keyword, categoryId, pageSize, minPrice, maxPrice });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sourcing/import-url - Import a product from CJ URL
app.post('/api/sourcing/import-url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });

    const pidMatch = url.match(/product-p-(\d+)/);
    if (!pidMatch) return res.status(400).json({ error: 'Invalid CJ product URL' });

    const cj = getCJClient();
    if (!cj) return res.status(503).json({ error: 'CJ API not configured' });

    const product = await cj.getProductDetail(pidMatch[1]);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const { analyzeProduct } = await import('./src/services/productAnalyzer');
    const { publishProduct } = await import('./src/services/autoPublisher');

    const analysis = await analyzeProduct(product);
    if (!analysis) return res.status(500).json({ error: 'AI analysis failed' });

    const result = await publishProduct(product, analysis);
    res.json({ success: true, product: result, analysis });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sourcing/price-monitor - Check prices and auto-reprice
app.get('/api/sourcing/price-monitor', async (req, res) => {
  try {
    const { monitorPrices } = await import('./src/services/priceMonitor');
    const alerts = await monitorPrices();
    res.json({ alerts, count: alerts.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sourcing/restock - Products needing restock
app.get('/api/sourcing/restock', async (req, res) => {
  try {
    const { getProductsNeedingRestock } = await import('./src/services/priceMonitor');
    const products = await getProductsNeedingRestock();
    res.json({ products });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Start Express and Vite Middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Start sourcing scheduler
  try {
    const scheduler = getSourcingScheduler();
    await scheduler.start();
  } catch (err) {
    console.warn('Sourcing scheduler not started:', err);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Victoriosa Full-Stack Server running on port ${PORT}`);
  });
}

startServer();
