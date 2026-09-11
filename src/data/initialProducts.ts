import type { Product } from '../types';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: "vic-prod-auriculares-anc",
    status: "published",
    title: "Auriculares Hi-Fi Espaciales con Cancelación Activa Híbrida 42dB",
    originalTitle: "Acoustix ANC Wireless Headphones Bluetooth 5.4 50h Playtime Over-Ear",
    subtitle: "Inmersión acústica pura con transductores de titanio y almohadillas memory foam refrigerantes",
    slug: "auriculares-hi-fi-espaciales-anc-42db",
    category: "Tecnología & Gadgets",
    subCategory: "Audio Prémium",
    tags: ["Audio Hi-Res", "Cancelación Ruido", "Bluetooth 5.4", "Victoriosa Select"],
    brand: "Victoriosa",
    description: "Los Auriculares Hi-Fi Victoriosa combinan ingeniería acústica de vanguardia con un diseño escandinavo atemporal. Su sistema de cancelación activa híbrida de 42dB bloquea eficazmente cualquier distracción ambiental, mientras que los transductores de titanio de 40mm ofrecen graves profundos y agudos cristalinos con certificación Hi-Res Audio.\n\nDiseñados para sesiones maratonianas, sus almohadillas de espuma viscoelástica con gel refrigerante proporcionan una comodidad inigualable durante sus más de 50 horas de autonomía ininterrumpida.",
    originalDescription: "Bluetooth headphones with noise cancellation, long battery life, mic for calls, foldable design.",
    features: [
      "Cancelación de Ruido Activa Híbrida (ANC) con 3 niveles y modo transparencia ambiental",
      "Transductores de neodimio y titanio de 40mm calibrados para audio espacial 360°",
      "Autonomía récord de 50 horas con carga ultra-rápida (10 min = 5 horas de reproducción)",
      "Conectividad Bluetooth 5.4 multipunto para alternar entre móvil y portátil al instante",
      "Micrófonos cuádruples con algoritmo de aislamiento de voz por IA para llamadas nítidas"
    ],
    specs: {
      "Conectividad": "Bluetooth 5.4 & Jack 3.5mm Hi-Res",
      "Autonomía": "50 horas (ANC off) / 38 horas (ANC on)",
      "Cancelación": "ANC Híbrido hasta -42dB",
      "Peso": "248 gramos",
      "Material": "Aluminio anodizado y cuero vegano prémium",
      "Garantía": "3 Años Victoriosa Care Direct"
    },
    images: [
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=900&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=900&auto=format&fit=crop&q=80"
    ],
    originalImages: [
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&auto=format&fit=crop&q=80"
    ],
    price: 129.95,
    compareAtPrice: 179.95,
    costPrice: 42.00,
    inventory: 48,
    sku: "VIC-AUD-7721",
    variants: [
      {
        id: "v-finish",
        name: "Acabado",
        options: ["Negro Mate Espacial", "Plata Titanio Satinado", "Champagne Aurora"]
      }
    ],
    badges: ["Top Ventas Victoriosa", "Garantía Oficial 3 Años", "Envío Gratis 24h"],
    rating: 4.9,
    reviewCount: 142,
    traceability: {
      createdBy: "Victoriosa Autopilot Core v3.0 (Gemini Powered)",
      createdAt: "2026-08-15T10:30:00.000Z",
      updatedAt: "2026-08-16T14:20:00.000Z",
      source: {
        name: "Acoustix Precision Lab",
        url: "https://amazon.com/dp/B09X8AUST7",
        platform: "Amazon Global",
        sku: "AMZ-ACX-440",
        rating: 4.8,
        rawCategory: "Electronics / Headphones"
      },
      supplier: {
        name: "Acoustix Precision GmbH",
        reliabilityScore: 96,
        country: "Alemania / Centro Logístico Valencia",
        shippingDaysMin: 1,
        shippingDaysMax: 3,
        returnPolicy: "30 días sin coste con recogida garantizada"
      },
      pricing: {
        originalCostEur: 42.00,
        originalCurrency: "EUR",
        supplierShippingCost: 3.50,
        estimatedCustoms: 1.68,
        gatewayFee: 4.12,
        targetMarginPct: 58,
        suggestedPrice: 129.95,
        retailPrice: 129.95,
        potentialProfit: 78.65,
        psychologicalEnding: "95"
      },
      analysis: {
        demandScore: 94,
        competitionLevel: "medium",
        marginPotential: 92,
        brandFitScore: 96,
        brandFitJustification: "Estética minimalista sofisticada, materiales duraderos y acústica superior que eleva la percepción de marca.",
        qualityScore: 95,
        logisticsScore: 98,
        overallScore: 95,
        scoreTier: "S",
        targetAudience: "Profesionales, creadores de contenido y amantes del buen sonido",
        keySellingPoints: [
          "Margen neto extraordinario de 78.65€ por unidad",
          "Tasa de devolución histórica inferior al 1.2%",
          "Garantía directa con almacén logístico en España"
        ],
        validatedClaims: ["Certificado CE / RoHS", "Cancelación medida en laboratorio -42.4dB"],
        potentialIssues: ["Mantener volumen de pedidos mínimos para preservar precio de costo"]
      },
      risk: {
        level: "low",
        copyrightRisk: "none",
        claimsRisk: "safe",
        supplierRisk: "safe",
        returnRisk: "low",
        details: ["Sin disputas de patentes registradas", "Proveedor con certificación ISO9001"]
      },
      history: [
        {
          timestamp: "2026-08-15T10:30:00.000Z",
          stage: "discovery",
          fromStatus: "discovered",
          toStatus: "analyzing",
          action: "Producto detectado en feed Amazon Global por crawler automatizado",
          actor: "Crawler Bot v2.4"
        },
        {
          timestamp: "2026-08-15T10:32:15.000Z",
          stage: "analysis",
          fromStatus: "analyzing",
          toStatus: "ready_for_review",
          action: "Evaluación multidimensional de márgenes, calidad y marca completada",
          actor: "Gemini Analysis Engine"
        },
        {
          timestamp: "2026-08-15T12:00:00.000Z",
          stage: "review",
          fromStatus: "ready_for_review",
          toStatus: "approved",
          action: "Aprobación automática por superar Score 95 con Riesgo Bajo",
          actor: "Autopilot Rule Engine"
        },
        {
          timestamp: "2026-08-16T14:20:00.000Z",
          stage: "publication",
          fromStatus: "approved",
          toStatus: "published",
          action: "Publicación sincronizada en el catálogo público de Victoriosa",
          actor: "Catalog Sync Service"
        }
      ]
    }
  },
  {
    id: "vic-prod-lampara-escultorica",
    status: "published",
    title: "Lámpara de Mesa Escultórica con Carga Inalámbrica Qi2 y Atenuación Óptica",
    originalTitle: "Nordic Minimalist LED Desk Lamp with 15W Fast Wireless Charger Touch Dimming",
    subtitle: "Luz cálida bioclimática en aluminio aeroespacial satinado y base de terrazo pulido",
    slug: "lampara-mesa-escultorica-carga-qi2",
    category: "Hogar & Diseño",
    subCategory: "Iluminación de Autor",
    tags: ["Hogar Prémium", "Carga Inalámbrica", "Diseño Nórdico", "Iluminación Smart"],
    brand: "Victoriosa",
    description: "Una pieza de iluminación de autor que trasciende lo funcional para convertirse en una escultura viva en tu escritorio o mesita de noche. Forjada en aluminio aeroespacial con base en terrazo pulido a mano, ofrece un haz de luz suave sin parpadeos que respeta el ciclo circadiano.\n\nEn su base integra discretamente una estación de carga ultrarrápida Qi2 de 15W compatible con MagSafe y todos los smartphones modernos.",
    originalDescription: "Desk lamp LED with charger pad, 3 colors light, metal design.",
    features: [
      "Base de terrazo mineral natural pulido con estación magnética Qi2 de 15W",
      "Control táctil deslizante de intensidad fluida (0% a 100%) y 3 temperaturas de color (2700K - 5000K)",
      "Difusor óptico anti-fatiga visual con tecnología Flicker-Free certificada",
      "Estructura orientable de 360 grados en aluminio anonizado antihuellas",
      "Eficiencia energética A+++ con LED de vida útil estimada de 50.000 horas"
    ],
    specs: {
      "Material": "Aluminio aeroespacial y Terrazo natural",
      "Potencia LED": "12W (equivalente a 80W incandescente)",
      "Carga Inalámbrica": "Qi2 Fast Charge 15W / 10W / 7.5W",
      "Temperatura Color": "2700K (Cálido) a 5000K (Luz Natural)",
      "Dimensiones": "38cm x 16cm x 14cm",
      "Garantía": "3 Años Victoriosa"
    },
    images: [
      "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=900&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=900&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1540932239986-30128078f3c5?w=900&auto=format&fit=crop&q=80"
    ],
    originalImages: [
      "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=900&auto=format&fit=crop&q=80"
    ],
    price: 89.95,
    compareAtPrice: 120.00,
    costPrice: 28.50,
    inventory: 32,
    sku: "VIC-LMP-3012",
    variants: [
      {
        id: "v-base",
        name: "Base de Piedra",
        options: ["Terrazo Blanco Calacatta", "Basalto Negro Volcánico", "Arenisca Nórdica"]
      }
    ],
    badges: ["Diseño Exclusivo Victoriosa", "Envío Prémium 24h", "Bajo Consumo A+++"],
    rating: 4.8,
    reviewCount: 67,
    traceability: {
      createdBy: "Victoriosa Autopilot Core v3.0 (Gemini Powered)",
      createdAt: "2026-08-18T08:15:00.000Z",
      updatedAt: "2026-08-19T11:00:00.000Z",
      source: {
        name: "Lumina Nordics Studio",
        url: "https://trendyol.com/brand/lumina/item-88",
        platform: "Trendyol Select",
        sku: "TY-LMN-992",
        rating: 4.9,
        rawCategory: "Home & Living / Lighting"
      },
      supplier: {
        name: "Lumina Nordics SL",
        reliabilityScore: 94,
        country: "Dinamarca / Almacén Madrid",
        shippingDaysMin: 2,
        shippingDaysMax: 4,
        returnPolicy: "Devolución en 30 días sin preguntas"
      },
      pricing: {
        originalCostEur: 28.50,
        originalCurrency: "EUR",
        supplierShippingCost: 4.00,
        estimatedCustoms: 1.14,
        gatewayFee: 2.95,
        targetMarginPct: 60,
        suggestedPrice: 89.95,
        retailPrice: 89.95,
        potentialProfit: 53.36,
        psychologicalEnding: "95"
      },
      analysis: {
        demandScore: 89,
        competitionLevel: "low",
        marginPotential: 94,
        brandFitScore: 98,
        brandFitJustification: "Producto icónico con alta tracción visual en redes y satisfacción garantizada.",
        qualityScore: 93,
        logisticsScore: 95,
        overallScore: 93,
        scoreTier: "S",
        targetAudience: "Amantes de la arquitectura interior, teletrabajadores y deco-lovers",
        keySellingPoints: [
          "Diseño diferencial frente a lámparas genéricas de plástico",
          "Margen bruto superior al 60%",
          "Presentación con unboxing de lujo Victoriosa"
        ],
        validatedClaims: ["Certificado Qi2 WPC", "Prueba de aislamiento térmico aprobada"],
        potentialIssues: ["Empaquetado reforzado para la base de terrazo"]
      },
      risk: {
        level: "low",
        copyrightRisk: "none",
        claimsRisk: "safe",
        supplierRisk: "safe",
        returnRisk: "low",
        details: ["Certificados CE y TÜV Rheinland vigentes"]
      },
      history: [
        {
          timestamp: "2026-08-18T08:15:00.000Z",
          stage: "discovery",
          fromStatus: "discovered",
          toStatus: "analyzing",
          action: "Ingesta automática desde Trendyol Select Hub",
          actor: "Crawler Bot v2.4"
        },
        {
          timestamp: "2026-08-18T08:18:20.000Z",
          stage: "analysis",
          fromStatus: "analyzing",
          toStatus: "approved",
          action: "Aprobación directa por Score 93 y Riesgo Bajo",
          actor: "Gemini Analysis Engine"
        },
        {
          timestamp: "2026-08-19T11:00:00.000Z",
          stage: "publication",
          fromStatus: "approved",
          toStatus: "published",
          action: "Publicado en tienda pública en categoría Hogar & Diseño",
          actor: "Catalog Sync Service"
        }
      ]
    }
  },
  {
    id: "vic-prod-reloj-cronografo",
    status: "published",
    title: "Reloj Cronógrafo Automático en Acero 316L con Cristal de Zafiro Antirreflejos",
    originalTitle: "Men Automatic Chronograph Watch Sapphire Crystal Stainless Steel 316L",
    subtitle: "Precisión mecánica de 28.800 alternancias con reserva de marcha de 42 horas",
    slug: "reloj-cronografo-automatico-zafiro-316l",
    category: "Moda & Accesorios",
    subCategory: "Alta Relojería Accesible",
    tags: ["Reloj Automático", "Acero 316L", "Zafiro", "Victoriosa Signature"],
    brand: "Victoriosa",
    description: "Una oda a la micromecánica clásica adaptada a la estética contemporánea de Victoriosa. Su caja esculpida en acero quirúrgico 316L encierra un calibre mecánico automático visible a través del fondo de cristal transparente.\n\nProtegido por un cristal de zafiro de triple capa antirreflejos prácticamente indestructible y resistente al agua hasta 100 metros (10 ATM).",
    originalDescription: "Stainless steel mechanical watch, water resistant 100m, automatic movement.",
    features: [
      "Calibre automático japonés de 24 rubíes con frecuencia de 21.600 A/h",
      "Cristal de zafiro frontal y trasero ultra resistente a arañazos grado 9 Mohs",
      "Hermeticidad 10 ATM (100 metros) con corona roscada de seguridad",
      "Manecillas e índices con tratamiento fotoluminiscente Super-LumiNova BGW9",
      "Correa de acero macizo con cierre mariposa desplegable grabado Victoriosa"
    ],
    specs: {
      "Diámetro caja": "40 mm",
      "Grosor": "11.8 mm",
      "Movimiento": "Mecánico Automático 24 Jewels",
      "Resistencia Agua": "10 ATM / 100 m",
      "Cristal": "Zafiro con recubrimiento antirreflejos",
      "Garantía": "3 Años Victoriosa International"
    },
    images: [
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=900&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=900&auto=format&fit=crop&q=80"
    ],
    originalImages: [
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&auto=format&fit=crop&q=80"
    ],
    price: 199.95,
    compareAtPrice: 289.00,
    costPrice: 65.00,
    inventory: 19,
    sku: "VIC-WAT-8812",
    variants: [
      {
        id: "v-dial",
        name: "Esfera / Dial",
        options: ["Azul Océano Profundo", "Negro Ónix", "Verde Esmeralda Sunray"]
      }
    ],
    badges: ["Edición Limitada", "Garantía 3 Años", "Envío Asegurado"],
    rating: 5.0,
    reviewCount: 43,
    traceability: {
      createdBy: "Victoriosa Autopilot Core v3.0 (Gemini Powered)",
      createdAt: "2026-08-20T14:10:00.000Z",
      updatedAt: "2026-08-21T09:30:00.000Z",
      source: {
        name: "Horology Craft Guild",
        url: "https://supplier-hub.internal/sku/HCG-CHRONO-316",
        platform: "Wholesale Hub",
        sku: "WH-HCG-316",
        rating: 4.9,
        rawCategory: "Watches & Jewelry"
      },
      supplier: {
        name: "Vanguard Precision Watchmakers",
        reliabilityScore: 97,
        country: "Suiza / Montaje UE",
        shippingDaysMin: 2,
        shippingDaysMax: 3,
        returnPolicy: "Garantía de satisfacción 30 días"
      },
      pricing: {
        originalCostEur: 65.00,
        originalCurrency: "EUR",
        supplierShippingCost: 5.00,
        estimatedCustoms: 2.60,
        gatewayFee: 6.15,
        targetMarginPct: 62,
        suggestedPrice: 199.95,
        retailPrice: 199.95,
        potentialProfit: 121.20,
        psychologicalEnding: "95"
      },
      analysis: {
        demandScore: 92,
        competitionLevel: "medium",
        marginPotential: 96,
        brandFitScore: 99,
        brandFitJustification: "Encaja como buque insignia en la colección de accesorios de lujo accesible de Victoriosa.",
        qualityScore: 97,
        logisticsScore: 94,
        overallScore: 96,
        scoreTier: "S",
        targetAudience: "Compradores de relojería prémium, regalos especiales y estilo ejecutivo",
        keySellingPoints: [
          "Margen unitario sobresaliente (+120€ beneficio bruto)",
          "Alta percepción de valor superior a 350€ en mercado tradicional",
          "Estuche de piel de presentación incluido"
        ],
        validatedClaims: ["Cristal de zafiro comprobado con tester de dureza", "Prueba de estanqueidad 10 ATM individual"],
        potentialIssues: ["Control de calidad por lote para asegurar calibración precisa"]
      },
      risk: {
        level: "low",
        copyrightRisk: "none",
        claimsRisk: "safe",
        supplierRisk: "safe",
        returnRisk: "low",
        details: ["Diseño original patentado por el fabricante", "Sin infracciones de marca registrada"]
      },
      history: [
        {
          timestamp: "2026-08-20T14:10:00.000Z",
          stage: "discovery",
          fromStatus: "discovered",
          toStatus: "analyzing",
          action: "Descubrimiento en Wholesale Hub con ratio de fiabilidad 97%",
          actor: "Autopilot AI Scraper"
        },
        {
          timestamp: "2026-08-20T14:15:00.000Z",
          stage: "analysis",
          fromStatus: "analyzing",
          toStatus: "approved",
          action: "Puntuación de 96/100 (Tier S) — Aprobado",
          actor: "Gemini Analysis Engine"
        },
        {
          timestamp: "2026-08-21T09:30:00.000Z",
          stage: "publication",
          fromStatus: "approved",
          toStatus: "published",
          action: "Publicado en la colección oficial de Victoriosa",
          actor: "Catalog Sync Service"
        }
      ]
    }
  },
  {
    id: "vic-prod-cafetera-precision",
    status: "published",
    title: "Cafetera de Goteo de Precisión con Control Térmico PID y Jarra Térmica al Vacío",
    originalTitle: "Precision Drip Coffee Maker PID Temperature Control Double Wall Thermal Carafe",
    subtitle: "Extracción barista estándar SCA con pre-infusión programable en acero cepillado",
    slug: "cafetera-goteo-precision-pid-jarra-termica",
    category: "Hogar & Diseño",
    subCategory: "Café de Especialidad",
    tags: ["Café Gourmet", "Hogar", "Acero Inoxidable", "SCA Certified"],
    brand: "Victoriosa",
    description: "Diseñada para los paladares más exigentes del café de especialidad. La cafetera Victoriosa incorpora un controlador térmico PID que mantiene el agua exactamente a la temperatura ideal de extracción (92°C - 96°C) durante todo el ciclo.\n\nSu cabezal de ducha de dispersión multidireccional garantiza una saturación uniforme de la molienda, resaltando todas las notas aromáticas en su jarra térmica de doble pared que mantiene el café caliente durante horas sin quemarlo.",
    originalDescription: "Coffee maker electric drip, stainless steel, digital timer, keep warm.",
    features: [
      "Control térmico PID digital con tolerancia estricta de ±0.5°C",
      "Cabezal de dispersión de 12 salidas para saturación uniforme y pre-infusión automática",
      "Jarra térmica de doble pared de vacío en acero 304 que conserva el calor 6 horas",
      "Certificación según los estándares de extracción dorada de la SCA (Specialty Coffee Association)",
      "Temporizador digital de inicio programable para despertar con el aroma del café recién hecho"
    ],
    specs: {
      "Capacidad": "1.25 Litros (10 Tazas)",
      "Potencia": "1450W",
      "Rango de Temperatura": "90°C a 96°C programable",
      "Material": "Acero inoxidable 304 cepillado y componentes BPA Free",
      "Garantía": "3 Años Victoriosa"
    },
    images: [
      "https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=900&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=900&auto=format&fit=crop&q=80"
    ],
    originalImages: [
      "https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=900&auto=format&fit=crop&q=80"
    ],
    price: 149.95,
    compareAtPrice: 189.95,
    costPrice: 51.00,
    inventory: 26,
    sku: "VIC-COF-4190",
    badges: ["SCA Standard", "Garantía 3 Años", "Envío Gratis"],
    rating: 4.9,
    reviewCount: 88,
    traceability: {
      createdBy: "Victoriosa Autopilot Core v3.0 (Gemini Powered)",
      createdAt: "2026-08-22T11:00:00.000Z",
      updatedAt: "2026-08-23T16:00:00.000Z",
      source: {
        name: "BrewCraft Direct",
        url: "https://amazon.es/dp/B08COF889",
        platform: "Amazon Global",
        sku: "AMZ-BCF-991",
        rating: 4.8,
        rawCategory: "Kitchen / Coffee"
      },
      supplier: {
        name: "BrewCraft Logistics Madrid",
        reliabilityScore: 95,
        country: "España",
        shippingDaysMin: 1,
        shippingDaysMax: 3,
        returnPolicy: "30 días de prueba sin compromiso"
      },
      pricing: {
        originalCostEur: 51.00,
        originalCurrency: "EUR",
        supplierShippingCost: 4.50,
        estimatedCustoms: 2.04,
        gatewayFee: 4.70,
        targetMarginPct: 56,
        suggestedPrice: 149.95,
        retailPrice: 149.95,
        potentialProfit: 87.71,
        psychologicalEnding: "95"
      },
      analysis: {
        demandScore: 91,
        competitionLevel: "medium",
        marginPotential: 90,
        brandFitScore: 97,
        brandFitJustification: "Ideal para el posicionamiento de estilo de vida gourmet y diseño.",
        qualityScore: 96,
        logisticsScore: 95,
        overallScore: 94,
        scoreTier: "S",
        targetAudience: "Aficionados al café de especialidad y diseño de cocinas",
        keySellingPoints: [
          "Cumple estrictamente los estándares de la SCA",
          "Margen superior a 87€ por venta",
          "Excelente puntuación de satisfacción del cliente"
        ],
        validatedClaims: ["Certificación alimentaria LFGB / FDA", "BPA Free testado"],
        potentialIssues: ["Asegurar filtros de recambio disponibles como accesorio recomendado"]
      },
      risk: {
        level: "low",
        copyrightRisk: "none",
        claimsRisk: "safe",
        supplierRisk: "safe",
        returnRisk: "low",
        details: ["Certificaciones sanitarias y eléctricas europeas al día"]
      },
      history: [
        {
          timestamp: "2026-08-22T11:00:00.000Z",
          stage: "discovery",
          fromStatus: "discovered",
          toStatus: "approved",
          action: "Análisis y aprobación directa",
          actor: "Autopilot AI Pipeline"
        },
        {
          timestamp: "2026-08-23T16:00:00.000Z",
          stage: "publication",
          fromStatus: "approved",
          toStatus: "published",
          action: "Publicado en el catálogo oficial de Victoriosa",
          actor: "Catalog Sync Service"
        }
      ]
    }
  },
  {
    id: "vic-prod-difusor-ultrasonico",
    status: "ready_for_review",
    title: "Difusor de Aromaterapia Ultrasónico en Cerámica Hecha a Mano con Niebla Fría",
    originalTitle: "Handmade Ceramic Essential Oil Diffuser Ultrasonic 300ml Ambient Warm Light",
    subtitle: "Textura mineral artesanal con apagado automático por sensor y luz ambiente cálida",
    slug: "difusor-ultrasonico-ceramica-artesanal",
    category: "Belleza & Bienestar",
    subCategory: "Ambiente & Spa",
    tags: ["Cerámica", "Bienestar", "Aromaterapia", "Silencioso"],
    brand: "Victoriosa",
    description: "Moldeado a mano en cerámica mate con un acabado de textura orgánica que encaja en cualquier santuario personal. Mediante vibración ultrasónica a 2.4 MHz, dispersa los aceites esenciales en una micro-niebla ultrafina sin alterar sus propiedades terapéuticas.",
    originalDescription: "Ceramic diffuser for essential oils with LED light and timer.",
    features: [
      "Cubierta exterior de cerámica cocida a mano con acabado mate sedoso",
      "Depósito interno de 280ml para hasta 10 horas de difusión continua o 18h intermitente",
      "Funcionamiento ultra silencioso (<19 dB) ideal para meditación o dormitorio",
      "Luz ambiente cálida integrada con opción de respiración guiada para conciliar el sueño"
    ],
    specs: {
      "Capacidad": "280 ml",
      "Material": "Cerámica artesanal y polímero médico",
      "Nivel sonoro": "<19 dB",
      "Cobertura": "Hasta 40 m²",
      "Garantía": "3 Años Victoriosa"
    },
    images: [
      "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=900&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1602928321679-560bb453f190?w=900&auto=format&fit=crop&q=80"
    ],
    originalImages: [
      "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=900&auto=format&fit=crop&q=80"
    ],
    price: 59.95,
    compareAtPrice: 79.00,
    costPrice: 18.00,
    inventory: 35,
    sku: "VIC-DIF-1020",
    badges: ["Cerámica Artesanal", "Garantía 3 Años", "Ultra Silencioso"],
    rating: 4.7,
    reviewCount: 31,
    traceability: {
      createdBy: "Victoriosa Autopilot Core v3.0 (Gemini Powered)",
      createdAt: "2026-08-25T16:40:00.000Z",
      updatedAt: "2026-08-25T16:45:00.000Z",
      source: {
        name: "Artisan Living Feed",
        url: "https://supplier.artisan/item/diffuser-ceramic-300",
        platform: "Artisan Feed",
        sku: "ART-DIF-280",
        rating: 4.7,
        rawCategory: "Home Decor / Wellness"
      },
      supplier: {
        name: "Ceramic Studio Valencia",
        reliabilityScore: 90,
        country: "España / Portugal",
        shippingDaysMin: 2,
        shippingDaysMax: 4,
        returnPolicy: "30 días devolución gratuita"
      },
      pricing: {
        originalCostEur: 18.00,
        originalCurrency: "EUR",
        supplierShippingCost: 3.20,
        estimatedCustoms: 0.72,
        gatewayFee: 2.08,
        targetMarginPct: 62,
        suggestedPrice: 59.95,
        retailPrice: 59.95,
        potentialProfit: 35.95,
        psychologicalEnding: "95"
      },
      analysis: {
        demandScore: 84,
        competitionLevel: "low",
        marginPotential: 88,
        brandFitScore: 92,
        brandFitJustification: "Excelente encaje en la categoría de bienestar y relajación de Victoriosa.",
        qualityScore: 89,
        logisticsScore: 91,
        overallScore: 86,
        scoreTier: "A",
        targetAudience: "Personas enfocadas en wellness, yoga, autocuidado y estética minimalista",
        keySellingPoints: [
          "Producto con encanto artesanal real",
          "Margen saludable y empaque ligero de bajo coste logístico"
        ],
        validatedClaims: ["Certificado CE / RoHS"],
        potentialIssues: ["Requiere revisión de fotos para confirmar tono de color final antes de publicar"]
      },
      risk: {
        level: "low",
        copyrightRisk: "none",
        claimsRisk: "safe",
        supplierRisk: "safe",
        returnRisk: "low",
        details: ["Revisión pendiente por el administrador para verificación de packaging."]
      },
      history: [
        {
          timestamp: "2026-08-25T16:40:00.000Z",
          stage: "discovery",
          fromStatus: "discovered",
          toStatus: "analyzing",
          action: "Ingesta desde Artisan Feed",
          actor: "Autopilot Crawler"
        },
        {
          timestamp: "2026-08-25T16:45:00.000Z",
          stage: "review",
          fromStatus: "analyzing",
          toStatus: "ready_for_review",
          action: "Análisis completado (Score: 86). En espera de aprobación manual.",
          actor: "Gemini Analysis Engine"
        }
      ]
    }
  },
  {
    id: "vic-prod-smart-bottle-temp",
    status: "discovered",
    title: "Botella Térmica Inteligente con Pantalla Táctil OLED de Temperatura y Esterilización UV-C",
    originalTitle: "Smart Vacuum Water Bottle Touch Screen Temperature Display UV Sterilization 500ml",
    subtitle: "Acero quirúrgico de doble pared con sensor de temperatura en tapa",
    slug: "botella-termica-inteligente-uvc-oled",
    category: "Fitness & Outdoor",
    subCategory: "Hidratación Inteligente",
    tags: ["Smart Bottle", "Fitness", "Acero 316"],
    brand: "Victoriosa",
    description: "Botella térmica inteligente que monitoriza en tiempo real la temperatura del agua con un toque en la tapa y desinfecta el interior con luz UV-C.",
    originalDescription: "Vacuum water bottle 500ml with digital screen and battery recharge.",
    features: [
      "Pantalla OLED integrada en la tapa con indicador de temperatura exacta",
      "Ciclo de autolimpieza mediante LED UV-C cada 2 horas",
      "Conserva bebidas frías 24h y calientes 12h"
    ],
    specs: {
      "Capacidad": "500 ml",
      "Material": "Acero Inoxidable 316 interior",
      "Batería": "Recargable magnética (30 días de uso por carga)"
    },
    images: [
      "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=900&auto=format&fit=crop&q=80"
    ],
    originalImages: [
      "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=900&auto=format&fit=crop&q=80"
    ],
    price: 49.95,
    compareAtPrice: 65.00,
    costPrice: 14.50,
    inventory: 50,
    sku: "VIC-BOT-9912",
    badges: ["Novedad Descubierta"],
    rating: 4.6,
    reviewCount: 15,
    traceability: {
      createdBy: "Crawler Bot v2.4 (Discovery Hook)",
      createdAt: "2026-09-01T18:00:00.000Z",
      updatedAt: "2026-09-01T18:00:00.000Z",
      source: {
        name: "Trendyol Select Supplier",
        url: "https://trendyol.com/item/smart-bottle-uv",
        platform: "Trendyol Select",
        sku: "TY-BOT-500",
        rating: 4.6,
        rawCategory: "Sports & Outdoors"
      },
      supplier: {
        name: "AquaTech Solutions",
        reliabilityScore: 88,
        country: "Turquía / España",
        shippingDaysMin: 3,
        shippingDaysMax: 6,
        returnPolicy: "14 días de devolución"
      },
      pricing: {
        originalCostEur: 14.50,
        originalCurrency: "EUR",
        supplierShippingCost: 3.00,
        estimatedCustoms: 0.58,
        gatewayFee: 1.80,
        targetMarginPct: 62,
        suggestedPrice: 49.95,
        retailPrice: 49.95,
        potentialProfit: 30.07,
        psychologicalEnding: "95"
      },
      analysis: {
        demandScore: 82,
        competitionLevel: "high",
        marginPotential: 86,
        brandFitScore: 80,
        brandFitJustification: "Buena oportunidad pero requiere verificar potencia real del LED UV-C antes de publicar.",
        qualityScore: 82,
        logisticsScore: 85,
        overallScore: 81,
        scoreTier: "B",
        targetAudience: "Deportistas, viajeros y profesionales activos",
        keySellingPoints: ["Diseño estético y tecnología atractiva"],
        validatedClaims: ["Hermeticidad confirmada"],
        potentialIssues: ["Comprobar informe de laboratorio de efectividad UV-C"]
      },
      risk: {
        level: "medium",
        copyrightRisk: "low",
        claimsRisk: "needs_disclaimer",
        supplierRisk: "safe",
        returnRisk: "medium",
        details: ["Revisar claims sobre esterilización bacteriana para cumplir normativa europea."]
      },
      history: [
        {
          timestamp: "2026-09-01T18:00:00.000Z",
          stage: "discovery",
          fromStatus: "discovered",
          toStatus: "discovered",
          action: "Oportunidad detectada por Autopilot Discovery Stream",
          actor: "Discovery Crawler"
        }
      ]
    }
  },
  {
    id: "vic-prod-rejected-replica",
    status: "rejected",
    rejectionReason: "Riesgo crítico de propiedad intelectual (infracción de diseño protegido y claims de marca no autorizados) y margen real insuficiente tras aranceles.",
    title: "Cargador Magnético 'Estilo Apple MagSafe' 3 en 1 Genérico",
    originalTitle: "3 in 1 Magnetic Wireless Fast Charger Pad Replica OEM",
    subtitle: "Producto descartado por el motor de compliance del Autopilot",
    slug: "cargador-magnetico-generico-rechazado",
    category: "Tecnología & Gadgets",
    subCategory: "Carga",
    tags: ["Rechazado", "Compliance"],
    brand: "Victoriosa",
    description: "Este producto fue detectado por el crawler pero automáticamente RECHAZADO por el sistema de Brand Safety y Compliance de Victoriosa al detectar palabras prohibidas y falta de certificados de seguridad eléctrica.",
    originalDescription: "Replica 3 in 1 charger for iPhone and watch and airpods cheap wholesale.",
    features: ["Rechazado por riesgo de sobrecalentamiento y conflicto de patentes"],
    specs: {
      "Motivo Rechazo": "Infracción de marca, sobrecalentamiento reportado en reviews del proveedor",
      "Dictamen": "Rechazado permanentemente para no procesar de nuevo"
    },
    images: [
      "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=900&auto=format&fit=crop&q=80"
    ],
    originalImages: [
      "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=900&auto=format&fit=crop&q=80"
    ],
    price: 19.95,
    costPrice: 11.00,
    inventory: 0,
    sku: "REJ-IP-4040",
    badges: ["RECHAZADO"],
    rating: 2.8,
    reviewCount: 6,
    traceability: {
      createdBy: "Crawler Bot v2.4",
      createdAt: "2026-08-28T09:00:00.000Z",
      updatedAt: "2026-08-28T09:02:00.000Z",
      source: {
        name: "AliExpress Direct Supplier #881",
        url: "https://aliexpress.com/item/replica-charger-991",
        platform: "AliExpress Direct",
        sku: "ALI-REP-991",
        rating: 3.6,
        rawCategory: "Electronics"
      },
      supplier: {
        name: "Fast Tech Wholesale OEM",
        reliabilityScore: 54,
        country: "China",
        shippingDaysMin: 12,
        shippingDaysMax: 25,
        returnPolicy: "Sin devoluciones"
      },
      pricing: {
        originalCostEur: 11.00,
        originalCurrency: "EUR",
        supplierShippingCost: 4.50,
        estimatedCustoms: 0.80,
        gatewayFee: 0.90,
        targetMarginPct: 20,
        suggestedPrice: 19.95,
        retailPrice: 19.95,
        potentialProfit: 2.75,
        psychologicalEnding: "95"
      },
      analysis: {
        demandScore: 65,
        competitionLevel: "high",
        marginPotential: 25,
        brandFitScore: 12,
        brandFitJustification: "Totalmente incompatible con el estándar de excelencia de Victoriosa.",
        qualityScore: 35,
        logisticsScore: 40,
        overallScore: 38,
        scoreTier: "D",
        targetAudience: "Ninguno",
        keySellingPoints: [],
        validatedClaims: [],
        potentialIssues: ["Riesgo eléctrico elevado", "Infracción de patente de diseño de Apple"]
      },
      risk: {
        level: "critical",
        copyrightRisk: "high",
        claimsRisk: "prohibited",
        supplierRisk: "unverified",
        returnRisk: "high",
        details: [
          "Uso ilegal de marcas registradas en el feed de origen",
          "Sin certificación CE verificable",
          "Tasa de fallo en test de voltaje superior al 8%"
        ]
      },
      history: [
        {
          timestamp: "2026-08-28T09:00:00.000Z",
          stage: "discovery",
          fromStatus: "discovered",
          toStatus: "analyzing",
          action: "Ingesta desde feed de marketplace",
          actor: "Discovery Bot"
        },
        {
          timestamp: "2026-08-28T09:02:00.000Z",
          stage: "risk",
          fromStatus: "analyzing",
          toStatus: "rejected",
          action: "RECHAZO AUTOMÁTICO INMUTABLE: Riesgo crítico de IP y fiabilidad <60%",
          actor: "Autopilot Compliance Firewall",
          notes: "El producto queda en lista negra para prevenir reprocesamiento."
        }
      ]
    }
  }
];

export const INITIAL_RUNS = [
  {
    id: "run-auto-1092",
    startedAt: "2026-09-01T14:00:00.000Z",
    completedAt: "2026-09-01T14:03:45.000Z",
    status: "completed" as const,
    trigger: "scheduled" as const,
    itemsFound: 14,
    itemsProcessed: 14,
    itemsApproved: 3,
    itemsPublished: 2,
    itemsRejected: 4,
    durationSeconds: 225,
    logs: [
      { timestamp: "2026-09-01T14:00:00.000Z", level: "info" as const, message: "Iniciando escaneo de tendencias en Amazon Global, Trendyol y Wholesale Hub." },
      { timestamp: "2026-09-01T14:01:10.000Z", level: "info" as const, message: "14 candidatos ingestados y normalizados en memoria." },
      { timestamp: "2026-09-01T14:02:00.000Z", level: "warn" as const, message: "4 productos descartados automáticamente por riesgo de claims o margen <40%." },
      { timestamp: "2026-09-01T14:02:40.000Z", level: "success" as const, message: "3 productos aprobados con Score >= 88." },
      { timestamp: "2026-09-01T14:03:45.000Z", level: "success" as const, message: "Ejecución completada con éxito. Catálogo público actualizado." }
    ]
  }
];
