import type { ConnectorStatus, ConnectorCapability, SourceProduct, PrePurchaseVerificationResult } from '../../types';
import type { SourceConnector, ConnectorSearchOptions, ConnectorVerificationOptions, ConnectorPurchasePayload, ConnectorPurchaseResponse } from './types';

export class AliExpressConnector implements SourceConnector {
  readonly id = 'aliexpress-direct';
  readonly name = 'AliExpress Product Research';
  readonly platform = 'AliExpress Direct' as const;
  readonly capabilities: ConnectorCapability[] = ['direct_url', 'manual_purchase'];

  private appKey = process.env.ALIEXPRESS_APP_KEY;
  private appSecret = process.env.ALIEXPRESS_APP_SECRET;

  getStatus(): ConnectorStatus {
    return this.isConfigured() ? 'REQUIRES_HUMAN_ACTION' : 'REQUIRES_CREDENTIALS';
  }

  getStatusReason(): string {
    return this.isConfigured()
      ? 'Credenciales detectadas, pero búsqueda/precio/stock live aún no están implementados. Requiere verificación humana.'
      : 'Faltan credenciales de AliExpress. Solo se admite registrar una URL para revisión manual.';
  }

  isConfigured(): boolean { return Boolean(this.appKey && this.appSecret); }
  async searchProducts(_options: ConnectorSearchOptions): Promise<SourceProduct[]> { return []; }

  async getProductByUrl(url: string): Promise<SourceProduct | null> {
    const itemId = url.match(/item\/(\d+)\.html/)?.[1];
    if (!itemId) return null;
    return {
      id: `ae-${itemId}`,
      connectorId: this.id,
      platform: this.platform,
      sourceUrl: url,
      sourceSku: itemId,
      sourceTitle: `AliExpress ${itemId} · datos comerciales pendientes`,
      sourceImages: [],
      sourceCost: 0,
      sourceCurrency: 'UNKNOWN',
      sourceShippingCost: 0,
      estimatedDeliveryDaysMin: 0,
      estimatedDeliveryDaysMax: 0,
      inStock: false,
      stockQuantity: undefined,
      supplierName: 'Pendiente de verificación',
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
      productTitle: 'AliExpress item pendiente de consulta live',
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
      flags: ['UNVERIFIED_SOURCE', 'REQUIRES_HUMAN_ACTION'],
      actionRequired: 'HUMAN_APPROVAL_REQUIRED',
      notes: 'No se consultó precio, stock, logística ni vendedor live. Requiere revisión humana o implementación real de la API.',
    };
  }

  async createPurchaseOrder(_payload: ConnectorPurchasePayload): Promise<ConnectorPurchaseResponse> {
    return {
      success: false,
      status: 'human_action_required',
      humanActionReason: 'La compra automática de AliExpress no está habilitada.',
      errorMessage: 'REQUIRES_HUMAN_ACTION',
    };
  }

  async getTracking(_supplierOrderReference: string) { return null; }
}
