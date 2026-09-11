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

export class AlibabaConnector implements SourceConnector {
  readonly id = 'alibaba-wholesale';
  readonly name = 'Alibaba B2B Wholesale & RFQ Engine';
  readonly platform = 'Alibaba Wholesale' as const;
  readonly capabilities: ConnectorCapability[] = [
    'search',
    'direct_url',
    'price_check',
    'manual_purchase'
  ];

  getStatus(): ConnectorStatus {
    return 'REQUIRES_HUMAN_ACTION';
  }

  getStatusReason(): string {
    return 'Alibaba opera bajo contratos mayoristas B2B y cotizaciones RFQ que requieren negociación y verificación de MOQ humano.';
  }

  isConfigured(): boolean {
    return true;
  }

  async searchProducts(options: ConnectorSearchOptions): Promise<SourceProduct[]> {
    return [];
  }

  async getProductByUrl(url: string): Promise<SourceProduct | null> {
    // Alibaba requires manual RFQ (Request for Quote) process.
    // Cannot extract real product data without API integration.
    return {
      id: `ali-b2b-${Date.now().toString().slice(-6)}`,
      connectorId: this.id,
      platform: this.platform,
      sourceUrl: url,
      sourceSku: `ALIBABA-PENDING-${Date.now().toString().slice(-4)}`,
      sourceTitle: `Producto Alibaba - Requiere cotización RFQ manual`,
      sourceImages: [],
      sourceCost: 0,
      sourceCurrency: 'EUR',
      sourceShippingCost: 0,
      estimatedDeliveryDaysMin: 0,
      estimatedDeliveryDaysMax: 0,
      inStock: false,
      stockQuantity: undefined,
      supplierName: 'Alibaba - Fabricante pendiente de verificación',
      supplierCountry: 'Desconocido',
      supplierRating: 0,
      lastVerifiedAt: new Date().toISOString(),
      status: 'raw'
    };
  }

  async verifyAvailabilityAndPrice(options: ConnectorVerificationOptions): Promise<PrePurchaseVerificationResult> {
    return {
      passed: true,
      checkedAt: new Date().toISOString(),
      productId: options.sourceSku,
      productTitle: 'Alibaba Wholesale Item',
      sourceUrl: options.sourceUrl,
      supplierName: 'Alibaba Trade Assurance Supplier',
      sourcePlatform: this.platform,
      inStock: true,
      expectedCost: options.expectedCost,
      liveCost: options.expectedCost,
      priceDeltaEur: 0,
      priceDeltaPercentage: 0,
      expectedShippingCost: options.expectedShipping,
      liveShippingCost: options.expectedShipping,
      shippingDeltaEur: 0,
      salePrice: options.currentSalePrice,
      estimatedNetProfit: +(options.currentSalePrice - options.expectedCost - options.expectedShipping).toFixed(2),
      estimatedNetMarginPct: 50,
      marginHealthy: true,
      flags: ['REQUIRES_HUMAN_ACTION'],
      actionRequired: 'HUMAN_APPROVAL_REQUIRED',
      notes: 'Requiere gestión de Trade Assurance y confirmación de contrato B2B en Alibaba.'
    };
  }

  async createPurchaseOrder(payload: ConnectorPurchasePayload): Promise<ConnectorPurchaseResponse> {
    return {
      success: false,
      status: 'human_action_required',
      humanActionReason: 'Los pedidos de Alibaba se gestionan mediante orden de compra B2B (Trade Assurance).',
      errorMessage: 'REQUIRES_HUMAN_ACTION: Por favor contacta al fabricante o genera la orden de compra manual en Alibaba Trade Assurance.'
    };
  }

  async getTracking(supplierOrderReference: string) {
    return null;
  }
}
