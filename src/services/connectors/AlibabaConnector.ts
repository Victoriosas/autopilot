import type { ConnectorStatus, ConnectorCapability, SourceProduct, PrePurchaseVerificationResult } from '../../types';
import type { SourceConnector, ConnectorSearchOptions, ConnectorVerificationOptions, ConnectorPurchasePayload, ConnectorPurchaseResponse } from './types';

export class AlibabaConnector implements SourceConnector {
  readonly id = 'alibaba-wholesale';
  readonly name = 'Alibaba B2B Research';
  readonly platform = 'Alibaba Wholesale' as const;
  readonly capabilities: ConnectorCapability[] = ['direct_url', 'manual_purchase'];

  getStatus(): ConnectorStatus { return 'REQUIRES_HUMAN_ACTION'; }
  getStatusReason(): string { return 'Alibaba RFQ/MOQ, precio, proveedor y logística deben confirmarse manualmente antes de usar el producto.'; }
  isConfigured(): boolean { return false; }
  async searchProducts(_options: ConnectorSearchOptions): Promise<SourceProduct[]> { return []; }

  async getProductByUrl(url: string): Promise<SourceProduct | null> {
    if (!/^https?:\/\//i.test(url)) return null;
    return {
      id: `ali-b2b-${Date.now().toString(36)}`,
      connectorId: this.id,
      platform: this.platform,
      sourceUrl: url,
      sourceSku: 'ALIBABA-UNVERIFIED',
      sourceTitle: 'Alibaba · cotización y proveedor pendientes',
      sourceImages: [],
      sourceCost: 0,
      sourceCurrency: 'UNKNOWN',
      sourceShippingCost: 0,
      estimatedDeliveryDaysMin: 0,
      estimatedDeliveryDaysMax: 0,
      inStock: false,
      stockQuantity: undefined,
      supplierName: 'Pendiente de RFQ y verificación',
      supplierCountry: 'Desconocido',
      supplierRating: 0,
      lastVerifiedAt: new Date().toISOString(),
      status: 'raw',
    };
  }

  async verifyAvailabilityAndPrice(options: ConnectorVerificationOptions): Promise<PrePurchaseVerificationResult> {
    const salePrice = Number(options.currentSalePrice || 0);
    const expectedCost = Number(options.expectedCost || 0);
    const expectedShipping = Number(options.expectedShipping || 0);
    const estimatedNetProfit = salePrice > 0 ? salePrice - expectedCost - expectedShipping : 0;
    const estimatedNetMarginPct = salePrice > 0 ? Number(((estimatedNetProfit / salePrice) * 100).toFixed(1)) : 0;
    return {
      passed: false,
      checkedAt: new Date().toISOString(),
      productId: options.sourceSku,
      productTitle: 'Alibaba item pendiente de RFQ',
      sourceUrl: options.sourceUrl,
      supplierName: 'Pendiente de verificación',
      sourcePlatform: this.platform,
      inStock: false,
      expectedCost,
      liveCost: expectedCost,
      priceDeltaEur: 0,
      priceDeltaPercentage: 0,
      expectedShippingCost: expectedShipping,
      liveShippingCost: expectedShipping,
      shippingDeltaEur: 0,
      salePrice,
      estimatedNetProfit: Number(estimatedNetProfit.toFixed(2)),
      estimatedNetMarginPct,
      marginHealthy: false,
      flags: ['UNVERIFIED_SOURCE', 'RFQ_REQUIRED', 'REQUIRES_HUMAN_ACTION'],
      actionRequired: 'HUMAN_APPROVAL_REQUIRED',
      notes: 'No existe cotización live verificada. MOQ, Trade Assurance, proveedor, coste y logística deben revisarse manualmente.',
    };
  }

  async createPurchaseOrder(_payload: ConnectorPurchasePayload): Promise<ConnectorPurchaseResponse> {
    return {
      success: false,
      status: 'human_action_required',
      humanActionReason: 'Alibaba requiere RFQ/contrato B2B y confirmación humana.',
      errorMessage: 'REQUIRES_HUMAN_ACTION',
    };
  }

  async getTracking(_supplierOrderReference: string) { return null; }
}
