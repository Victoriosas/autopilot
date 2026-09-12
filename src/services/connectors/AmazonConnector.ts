import type { ConnectorStatus, ConnectorCapability, SourceProduct, PrePurchaseVerificationResult } from '../../types';
import type { SourceConnector, ConnectorSearchOptions, ConnectorVerificationOptions, ConnectorPurchasePayload, ConnectorPurchaseResponse } from './types';

export class AmazonConnector implements SourceConnector {
  readonly id = 'amazon-global';
  readonly name = 'Amazon Product Research';
  readonly platform = 'Amazon Global' as const;
  readonly capabilities: ConnectorCapability[] = ['direct_url', 'manual_purchase'];

  private accessKey = process.env.AMAZON_ACCESS_KEY;
  private secretKey = process.env.AMAZON_SECRET_KEY;
  private partnerTag = process.env.AMAZON_PARTNER_TAG;

  getStatus(): ConnectorStatus {
    return this.isConfigured() ? 'REQUIRES_HUMAN_ACTION' : 'REQUIRES_CREDENTIALS';
  }

  getStatusReason(): string {
    return this.isConfigured()
      ? 'Credenciales detectadas, pero la consulta live no está implementada en este conector. Toda disponibilidad/precio requiere verificación humana.'
      : 'Faltan credenciales oficiales de Amazon. Solo se admite registrar un ASIN/URL para revisión manual.';
  }

  isConfigured(): boolean {
    return Boolean(this.accessKey && this.secretKey && this.partnerTag);
  }

  async searchProducts(_options: ConnectorSearchOptions): Promise<SourceProduct[]> {
    return [];
  }

  async getProductByUrl(url: string): Promise<SourceProduct | null> {
    const asinMatch = url.match(/(?:dp|gp\/product|\/d\/)\/([A-Z0-9]{10})/i);
    const asin = asinMatch?.[1];
    if (!asin) return null;
    return {
      id: `amz-${asin}`,
      connectorId: this.id,
      platform: this.platform,
      sourceUrl: url,
      sourceSku: asin,
      sourceTitle: `Amazon ASIN ${asin} · datos comerciales pendientes`,
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
    const estimate = salePrice > 0 ? salePrice - expectedCost - expectedShipping : 0;
    const estimatedNetMarginPct = salePrice > 0 ? Number(((estimate / salePrice) * 100).toFixed(1)) : 0;
    return {
      passed: false,
      checkedAt: new Date().toISOString(),
      productId: options.sourceSku,
      productTitle: 'Amazon item pendiente de verificación live',
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
      estimatedNetProfit: Number(estimate.toFixed(2)),
      estimatedNetMarginPct,
      marginHealthy: false,
      flags: ['UNVERIFIED_STOCK', 'REQUIRES_HUMAN_ACTION'],
      actionRequired: 'HUMAN_APPROVAL_REQUIRED',
      notes: 'No se consultó un precio, stock ni vendedor live. Los importes mostrados son valores esperados, no verificados.',
    };
  }

  async createPurchaseOrder(_payload: ConnectorPurchasePayload): Promise<ConnectorPurchaseResponse> {
    return {
      success: false,
      status: 'human_action_required',
      humanActionReason: 'La compra Amazon no está automatizada ni autorizada por este conector.',
      errorMessage: 'REQUIRES_HUMAN_ACTION',
    };
  }

  async getTracking(_supplierOrderReference: string) { return null; }
}
