import type { 
  ConnectorStatus, 
  ConnectorCapability, 
  SourceProduct, 
  PrePurchaseVerificationResult 
} from '../../types';
import type { 
  SourceConnector, 
  ConnectorSearchOptions, 
  ConnectorVerificationOptions, 
  ConnectorPurchasePayload, 
  ConnectorPurchaseResponse 
} from './types';

export class DirectUrlConnector implements SourceConnector {
  readonly id = 'direct-import';
  readonly name = 'Universal URL Importer & Metadata Extractor';
  readonly platform = 'Direct Import' as const;
  readonly capabilities: ConnectorCapability[] = [
    'direct_url',
    'price_check',
    'manual_purchase'
  ];

  getStatus(): ConnectorStatus {
    return 'NOT_CONFIGURED';
  }

  getStatusReason(): string {
    return 'Requiere integración con servicio de scraping/web scraping para extracción real de metadatos. Actualmente solo admite revisión manual.';
  }

  isConfigured(): boolean {
    return false;
  }

  async searchProducts(options: ConnectorSearchOptions): Promise<SourceProduct[]> {
    return [];
  }

  async getProductByUrl(url: string): Promise<SourceProduct | null> {
    if (!url || !url.startsWith('http')) {
      return null;
    }

    // Direct URL connector cannot extract product metadata without a real web scraper.
    // Returns minimal data requiring manual review by operator.
    const domain = new URL(url).hostname.replace('www.', '');
    const platform = url.includes('amazon.') ? 'Amazon Global' : 
                     url.includes('aliexpress.') ? 'AliExpress Direct' : 
                     url.includes('alibaba.') ? 'Alibaba Wholesale' : 'Direct Import';

    return {
      id: `url-imp-${Date.now().toString().slice(-6)}`,
      connectorId: this.id,
      platform,
      sourceUrl: url,
      sourceSku: `PENDING-${Date.now().toString().slice(-6)}`,
      sourceTitle: `Producto desde ${domain} - Requiere revisión manual`,
      sourceImages: [],
      sourceCost: 0,
      sourceCurrency: 'EUR',
      sourceShippingCost: 0,
      estimatedDeliveryDaysMin: 0,
      estimatedDeliveryDaysMax: 0,
      inStock: false,
      stockQuantity: undefined,
      supplierName: `${domain} - Pendiente de verificación`,
      supplierCountry: 'Desconocido',
      supplierRating: 0,
      lastVerifiedAt: new Date().toISOString(),
      status: 'raw'
    };
  }

  async verifyAvailabilityAndPrice(options: ConnectorVerificationOptions): Promise<PrePurchaseVerificationResult> {
    return {
      passed: false,
      checkedAt: new Date().toISOString(),
      productId: options.sourceSku,
      productTitle: 'Verificación de URL externa pendiente',
      sourceUrl: options.sourceUrl,
      supplierName: 'Proveedor Externo - Sin verificar',
      sourcePlatform: this.platform,
      inStock: false,
      stockAvailableQuantity: undefined,
      expectedCost: options.expectedCost,
      liveCost: options.expectedCost,
      priceDeltaEur: 0,
      priceDeltaPercentage: 0,
      expectedShippingCost: options.expectedShipping,
      liveShippingCost: options.expectedShipping,
      shippingDeltaEur: 0,
      salePrice: options.currentSalePrice,
      estimatedNetProfit: +(options.currentSalePrice - options.expectedCost - options.expectedShipping).toFixed(2),
      estimatedNetMarginPct: 0,
      marginHealthy: false,
      flags: ['REQUIRES_HUMAN_ACTION', 'UNVERIFIED_STOCK'],
      actionRequired: 'HUMAN_APPROVAL_REQUIRED',
      notes: 'No se puede verificar disponibilidad de URL externa sin integración de scraping. Requiere verificación manual por operador.'
    };
  }

  async createPurchaseOrder(payload: ConnectorPurchasePayload): Promise<ConnectorPurchaseResponse> {
    return {
      success: false,
      status: 'human_action_required',
      humanActionReason: 'URL externa sin API de compra automática. Se requiere compra asistida por operador.',
      errorMessage: 'REQUIRES_HUMAN_ACTION: Completa el pedido en la web de origen usando la dirección del cliente.'
    };
  }

  async getTracking(supplierOrderReference: string) {
    return null;
  }
}
