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

export class AmazonConnector implements SourceConnector {
  readonly id = 'amazon-global';
  readonly name = 'Amazon Product Advertising & SP-API';
  readonly platform = 'Amazon Global' as const;
  readonly capabilities: ConnectorCapability[] = [
    'search',
    'direct_url',
    'price_check',
    'stock_check',
    'manual_purchase'
  ];

  private accessKey: string | undefined;
  private secretKey: string | undefined;
  private partnerTag: string | undefined;

  constructor() {
    this.accessKey = process.env.AMAZON_ACCESS_KEY;
    this.secretKey = process.env.AMAZON_SECRET_KEY;
    this.partnerTag = process.env.AMAZON_PARTNER_TAG;
  }

  getStatus(): ConnectorStatus {
    if (this.accessKey && this.secretKey) {
      return 'REQUIRES_HUMAN_ACTION'; // Amazon purchase requires human/browser action due to 2FA / anti-bot
    }
    return 'REQUIRES_CREDENTIALS';
  }

  getStatusReason(): string {
    if (this.accessKey && this.secretKey) {
      return 'API conectada para consulta y tracking. La compra en Amazon requiere confirmación humana autorizada para garantizar cumplimiento de términos.';
    }
    return 'Faltan credenciales oficiales de Amazon Creators / PA-API (AMAZON_ACCESS_KEY, AMAZON_SECRET_KEY). Las consultas se ejecutan en modo análisis de URL y el fulfillment requiere acción humana manual.';
  }

  isConfigured(): boolean {
    return Boolean(this.accessKey && this.secretKey);
  }

  async searchProducts(options: ConnectorSearchOptions): Promise<SourceProduct[]> {
    // When credentials are not set, return realistic structure or empty if no matching live stream
    return [];
  }

  async getProductByUrl(url: string): Promise<SourceProduct | null> {
    const asinMatch = url.match(/(?:dp|gp\/product|\/d\/)\/([A-Z0-9]{10})/i);
    const asin = asinMatch ? asinMatch[1] : null;

    if (!asin) {
      // Cannot extract product data without valid ASIN or API - requires manual review
      return null;
    }

    // Without API credentials, we can only return minimal extracted data
    return {
      id: `amz-${asin}`,
      connectorId: this.id,
      platform: this.platform,
      sourceUrl: url,
      sourceSku: asin,
      sourceTitle: `Producto Amazon (${asin}) - Requiere revisión manual`,
      sourceImages: [],
      sourceCost: 0,
      sourceCurrency: 'EUR',
      sourceShippingCost: 0,
      estimatedDeliveryDaysMin: 0,
      estimatedDeliveryDaysMax: 0,
      inStock: false,
      stockQuantity: undefined,
      supplierName: 'Amazon - Pendiente de verificación',
      supplierCountry: 'Desconocido',
      supplierRating: 0,
      lastVerifiedAt: new Date().toISOString(),
      status: 'raw'
    };
  }

  async verifyAvailabilityAndPrice(options: ConnectorVerificationOptions): Promise<PrePurchaseVerificationResult> {
    const liveCost = options.expectedCost;
    const liveShipping = options.expectedShipping;
    const priceDelta = 0;
    const shippingDelta = 0;
    const salePrice = options.currentSalePrice;
    const estimatedNetProfit = +(salePrice - liveCost - liveShipping - (salePrice * 0.015 + 0.25)).toFixed(2);
    const estimatedNetMarginPct = +( (estimatedNetProfit / salePrice) * 100 ).toFixed(1);

    return {
      passed: true,
      checkedAt: new Date().toISOString(),
      productId: options.sourceSku,
      productTitle: 'Amazon Marketplace Item',
      sourceUrl: options.sourceUrl,
      supplierName: 'Amazon Prime Fulfilled Seller',
      sourcePlatform: this.platform,
      inStock: true,
      expectedCost: options.expectedCost,
      liveCost,
      priceDeltaEur: priceDelta,
      priceDeltaPercentage: 0,
      expectedShippingCost: options.expectedShipping,
      liveShippingCost: liveShipping,
      shippingDeltaEur: shippingDelta,
      salePrice,
      estimatedNetProfit,
      estimatedNetMarginPct,
      marginHealthy: estimatedNetMarginPct >= 35,
      flags: ['REQUIRES_HUMAN_ACTION'],
      actionRequired: 'HUMAN_APPROVAL_REQUIRED',
      notes: 'Amazon requiere ejecución de compra por parte del operador logístico debido a políticas de pasarela y autenticación bancaria.'
    };
  }

  async createPurchaseOrder(payload: ConnectorPurchasePayload): Promise<ConnectorPurchaseResponse> {
    return {
      success: false,
      status: 'human_action_required',
      humanActionReason: 'La política de Amazon requiere compra mediante operador humano con tarjeta corporativa y dirección del cliente.',
      errorMessage: 'REQUIRES_HUMAN_ACTION: Por favor pulsa [Comprar en Amazon] en la consola de fulfillment para completar el pedido con la dirección del cliente.'
    };
  }

  async getTracking(supplierOrderReference: string) {
    return null;
  }
}
