import type { Supplier } from '../types';

export const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: 'sup-acoustix-de',
    name: 'Acoustix Precision GmbH',
    code: 'SUP-ACX-001',
    supplierType: 'authorized_distributor',
    status: 'active',
    stockAvailability: 'in_stock',
    contact: {
      representative: 'Klaus Lindner',
      email: 'klindner@acoustix-precision.de',
      phone: '+49 89 2314 9901',
      address: 'Industriestraße 45',
      city: 'Múnich',
      country: 'Alemania',
      website: 'https://acoustix-precision.de',
      warehouseLocations: ['Múnich (Alemania)', 'Valencia Hub (España)', 'Róterdam (Países Bajos)']
    },
    catalogs: {
      categories: ['Tecnología & Gadgets', 'Audio Hi-Fi', 'Accesorios Tech'],
      brandNames: ['Acoustix Lab', 'SoundVibe Pro', 'TitanSonics'],
      totalSkus: 84,
      catalogUrl: 'https://catalog.acoustix-precision.de/v3/victoriosa'
    },
    pricingAgreements: {
      currency: 'EUR',
      paymentTerms: 'net_30',
      moq: 5,
      leadTimeDaysMin: 1,
      leadTimeDaysMax: 3,
      baseDiscountPct: 15,
      volumeTiers: [
        { minUnits: 10, discountPct: 18 },
        { minUnits: 50, discountPct: 24 },
        { minUnits: 150, discountPct: 30 }
      ],
      avgShippingPerUnit: 3.50,
      returnAgreement: 'Garantía 30 días cambio directo sin coste. Tasa de reposición cubierta al 100%.',
      contractExpiresAt: '2027-12-31'
    },
    metrics: {
      reliabilityScore: 96,
      fulfillmentRate: 99.2,
      defectRate: 0.3,
      avgDispatchDays: 1.2,
      auditStatus: 'certified_iso9001',
      totalOrdersPlaced: 142,
      lastOrderDate: '2026-08-20'
    },
    notes: 'Proveedor homologado de referencia para electrónica de audio. Hub logístico directo con España.'
  },
  {
    id: 'sup-lumina-nordics',
    name: 'Lumina Nordics Studio ApS',
    code: 'SUP-LUM-002',
    supplierType: 'manufacturer',
    status: 'active',
    stockAvailability: 'in_stock',
    contact: {
      representative: 'Astrid Vestergaard',
      email: 'partners@luminanordics.dk',
      phone: '+45 33 91 80 40',
      address: 'Østergade 18, 3. sal',
      city: 'Copenhague',
      country: 'Dinamarca',
      website: 'https://luminanordics.design',
      warehouseLocations: ['Copenhague (Dinamarca)', 'Hamburgo (Alemania)']
    },
    catalogs: {
      categories: ['Hogar & Diseño', 'Iluminación Escandinava', 'Decoración Prémium'],
      brandNames: ['Lumina CPH', 'Nordic Glow Studio', 'Vester Living'],
      totalSkus: 120,
      catalogUrl: 'https://b2b.luminanordics.design/feed'
    },
    pricingAgreements: {
      currency: 'EUR',
      paymentTerms: 'net_30',
      moq: 3,
      leadTimeDaysMin: 2,
      leadTimeDaysMax: 4,
      baseDiscountPct: 20,
      volumeTiers: [
        { minUnits: 15, discountPct: 25 },
        { minUnits: 60, discountPct: 32 }
      ],
      avgShippingPerUnit: 4.80,
      returnAgreement: 'Reemplazo express en caso de rotura de cristal en tránsito con seguro DPD.',
      contractExpiresAt: '2028-06-30'
    },
    metrics: {
      reliabilityScore: 98,
      fulfillmentRate: 98.8,
      defectRate: 0.2,
      avgDispatchDays: 1.5,
      auditStatus: 'certified_iso9001',
      totalOrdersPlaced: 98,
      lastOrderDate: '2026-08-25'
    },
    notes: 'Fabricación artesanal en vidrio soplado y aluminio reciclado anodizado. Embalajes sin plástico.'
  },
  {
    id: 'sup-kurogane-jp',
    name: 'Kurogane Craftworks Precision',
    code: 'SUP-KUR-003',
    supplierType: 'artisan_workshop',
    status: 'active',
    stockAvailability: 'limited',
    contact: {
      representative: 'Kenji Takahashi',
      email: 'export@kurogane-craft.jp',
      phone: '+81 3 5555 0192',
      address: '4-12-8 Ginza, Chuo-ku',
      city: 'Tokio',
      country: 'Japón',
      website: 'https://kurogane-craft.jp',
      warehouseLocations: ['Tokio (Japón)', 'Barcelona Bonded Warehouse (España)']
    },
    catalogs: {
      categories: ['Relojería & Cronógrafos', 'Accesorios de Precisión', 'Titanio y Cerámica'],
      brandNames: ['Kurogane Chrono', 'Takumi Atelier'],
      totalSkus: 45,
      catalogUrl: 'https://kurogane-craft.jp/b2b'
    },
    pricingAgreements: {
      currency: 'EUR',
      paymentTerms: 'escrow',
      moq: 2,
      leadTimeDaysMin: 3,
      leadTimeDaysMax: 6,
      baseDiscountPct: 25,
      volumeTiers: [
        { minUnits: 5, discountPct: 28 },
        { minUnits: 20, discountPct: 35 }
      ],
      avgShippingPerUnit: 8.50,
      returnAgreement: 'Certificado de autenticidad suizo-japonés y 5 años de garantía mecánica oficial.',
      contractExpiresAt: '2027-09-15'
    },
    metrics: {
      reliabilityScore: 99,
      fulfillmentRate: 99.5,
      defectRate: 0.1,
      avgDispatchDays: 2.0,
      auditStatus: 'certified_iso9001',
      totalOrdersPlaced: 64,
      lastOrderDate: '2026-08-22'
    },
    notes: 'Relojería mecánica de alta gama con cristales de zafiro antireflejos y cajas de titanio grado 5.'
  },
  {
    id: 'sup-vespera-madrid',
    name: 'Atelier Vespera Madrid S.L.',
    code: 'SUP-VES-004',
    supplierType: 'manufacturer',
    status: 'active',
    stockAvailability: 'in_stock',
    contact: {
      representative: 'Elena Morales',
      email: 'b2b@ateliervespera.es',
      phone: '+34 91 432 8820',
      address: 'Calle Serrano 92, 4º',
      city: 'Madrid',
      country: 'España',
      website: 'https://ateliervespera.es',
      warehouseLocations: ['Madrid (España)', 'Zaragoza Logística (España)']
    },
    catalogs: {
      categories: ['Moda & Marroquinería', 'Bolsos y Accesorios', 'Seda y Piel'],
      brandNames: ['Vespera Madrid', 'Legado Ibérico Atelier'],
      totalSkus: 68,
      catalogUrl: 'https://ateliervespera.es/victoriosa-b2b'
    },
    pricingAgreements: {
      currency: 'EUR',
      paymentTerms: 'net_15',
      moq: 1,
      leadTimeDaysMin: 1,
      leadTimeDaysMax: 2,
      baseDiscountPct: 22,
      volumeTiers: [
        { minUnits: 8, discountPct: 28 },
        { minUnits: 25, discountPct: 35 }
      ],
      avgShippingPerUnit: 2.90,
      returnAgreement: 'Devolución sin penalización durante 60 días. Envíos nacionales 24h con MRW Prémium.',
      contractExpiresAt: '2029-01-01'
    },
    metrics: {
      reliabilityScore: 97,
      fulfillmentRate: 99.0,
      defectRate: 0.2,
      avgDispatchDays: 0.8,
      auditStatus: 'verified',
      totalOrdersPlaced: 185,
      lastOrderDate: '2026-08-28'
    },
    notes: 'Piel curtida vegetal en Ubrique (España). Trazabilidad de origen y packaging de lujo incluido.'
  },
  {
    id: 'sup-aura-botanicals',
    name: 'Aura Botanicals Provence',
    code: 'SUP-AUR-005',
    supplierType: 'artisan_workshop',
    status: 'active',
    stockAvailability: 'in_stock',
    contact: {
      representative: 'Jean-Luc Dubois',
      email: 'export@aurabotanicals.fr',
      phone: '+33 4 90 71 30 12',
      address: 'Route de Valensole, Les Lavandes',
      city: 'Grasse / Valensole',
      country: 'Francia',
      website: 'https://aurabotanicals.fr',
      warehouseLocations: ['Grasse (Francia)', 'Lyon Hub (Francia)']
    },
    catalogs: {
      categories: ['Cuidado Personal & Belleza', 'Perfumería de Nicho', 'Aromaterapia'],
      brandNames: ['Aura Grasse', 'Essence Botanique'],
      totalSkus: 52,
      catalogUrl: 'https://aurabotanicals.fr/wholesale'
    },
    pricingAgreements: {
      currency: 'EUR',
      paymentTerms: 'net_30',
      moq: 6,
      leadTimeDaysMin: 2,
      leadTimeDaysMax: 4,
      baseDiscountPct: 18,
      volumeTiers: [
        { minUnits: 20, discountPct: 25 },
        { minUnits: 80, discountPct: 32 }
      ],
      avgShippingPerUnit: 3.80,
      returnAgreement: 'Certificación orgánica Ecocert y fórmulas veganas Cruelty-Free acreditadas.',
      contractExpiresAt: '2028-11-30'
    },
    metrics: {
      reliabilityScore: 94,
      fulfillmentRate: 97.5,
      defectRate: 0.4,
      avgDispatchDays: 1.8,
      auditStatus: 'verified',
      totalOrdersPlaced: 76,
      lastOrderDate: '2026-08-18'
    },
    notes: 'Fórmulas cosméticas de Grasse, aceites esenciales puros y packaging de vidrio violeta Miron.'
  },
  {
    id: 'sup-veloce-milano',
    name: 'Veloce Dynamics Milano S.r.l.',
    code: 'SUP-VEL-006',
    supplierType: 'direct_wholesaler',
    status: 'active',
    stockAvailability: 'in_stock',
    contact: {
      representative: 'Matteo Rossi',
      email: 'commerciale@velocemilano.it',
      phone: '+39 02 8847 2100',
      address: 'Via Montenapoleone 14',
      city: 'Milán',
      country: 'Italia',
      website: 'https://velocemilano.it',
      warehouseLocations: ['Milán (Italia)', 'Bologna Freight Center (Italia)']
    },
    catalogs: {
      categories: ['Estilo de Vida & Viajes', 'Gafas de Sol de Lujo', 'Equipaje de Titanio'],
      brandNames: ['Veloce Studio', 'Ottica Milano 1984'],
      totalSkus: 95,
      catalogUrl: 'https://velocemilano.it/b2b'
    },
    pricingAgreements: {
      currency: 'EUR',
      paymentTerms: 'net_30',
      moq: 4,
      leadTimeDaysMin: 2,
      leadTimeDaysMax: 3,
      baseDiscountPct: 20,
      volumeTiers: [
        { minUnits: 12, discountPct: 26 },
        { minUnits: 40, discountPct: 33 }
      ],
      avgShippingPerUnit: 4.20,
      returnAgreement: 'Reposición inmediata de unidades con estuches rígidos y bayetas de microfibra de seda.',
      contractExpiresAt: '2027-08-31'
    },
    metrics: {
      reliabilityScore: 95,
      fulfillmentRate: 98.2,
      defectRate: 0.3,
      avgDispatchDays: 1.4,
      auditStatus: 'certified_iso9001',
      totalOrdersPlaced: 110,
      lastOrderDate: '2026-08-27'
    },
    notes: 'Lentes polarizadas Carl Zeiss Vision y acetato Mazzucchelli italiano 100% biodegradable.'
  }
];
