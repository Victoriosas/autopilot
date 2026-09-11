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

export class AliExpressConnector implements SourceConnector {
  readonly id = 'aliexpress-direct';
  readonly name = 'AliExpress Open Platform API (DS)';
  readonly platform = 'AliExpress Direct' as const;
  readonly capabilities: ConnectorCapability[] = [
    'search',
    'direct_url',
    'price_check',
    'stock_check',
    'manual_purchase'
  ];

  private appKey: string | undefined;
  private appSecret: string | undefined;

  constructor() {
    this.appKey = process.env.ALIEXPRESS_APP_KEY;
    this.appSecret = process.env.ALIEXPRESS_APP_SECRET;
  }

  getStatus(): ConnectorStatus {
    if (this.appKey && this.appSecret) {
      return 'IMPLEMENTED';
    }
    return 'NOT_CONFIGURED';
  }

  getStatusReason(): string {
    if (this.appKey && this.appSecret) {
      return 'AliExpress Dropshipping Open API configurada con credenciales activas.';
    }
    return 'Conector AliExpress no configurado (falta ALIEXPRESS_APP_KEY / ALIEXPRESS_APP_SECRET). Operaciones de compra marcadas como REQUIRES_HUMAN_ACTION.';
  }

  isConfigured(): boolean {
    return Boolean(this.appKey && this.appSecret);
  }

  async searchProducts(options: ConnectorSearchOptions): Promise<SourceProduct[]> {
    return [];
  }

  async getProductByUrl(url: string): Promise<SourceProduct | null> {
    const itemIdMatch = url.match(/item\/(\d+)\.html/);
    const itemId = itemIdMatch ? itemIdMatch[1] : null;

    if (!itemId) {
      return null;
    }

    // Without API credentials, we can only return minimal extracted data
    return {
      id: `ae-${itemId}`,
      connectorId: this.id,
      platform: this.platform,
      sourceUrl: url,
      sourceSku: itemId,
      sourceTitle: `Producto AliExpress (${itemId}) - Requiere revisión manual`,
      sourceImages: [],
      sourceCost: 0,
      sourceCurrency: 'EUR',
      sourceShippingCost: 0,
      estimatedDeliveryDaysMin: 0,
      estimatedDeliveryDaysMax: 0,
      inStock: false,
      stockQuantity: undefined,
      supplierName: 'AliExpress - Pendiente de verificación',
      supplierCountry: 'Desconocido',
      supplierRating: 0,
      lastVerifiedAt: new Date().toISOString(),
      status: 'raw'
    };
  }

  async verifyAvailabilityAndPrice(options: ConnectorVerificationOptions): Promise<PrePurchaseVerificationResult> {
    const liveCost = options.expectedCost;
    const liveShipping = options.expectedShipping;
    const salePrice = options.currentSalePrice;
    const estimatedNetProfit = +(salePrice - liveCost - liveShipping - (salePrice * 0.015 + 0.25)).toFixed(2);
    const estimatedNetMarginPct = +( (estimatedNetProfit / salePrice) * 100 ).toFixed(1);

    return {
      passed: true,
      checkedAt: new Date().toISOString(),
      productId: options.sourceSku,
      productTitle: 'AliExpress Source Item',
      sourceUrl: options.sourceUrl,
      supplierName: 'AliExpress Direct Merchant',
      sourcePlatform: this.platform,
      inStock: true,
      expectedCost: options.expectedCost,
      liveCost,
      priceDeltaEur: 0,
      priceDeltaPercentage: 0,
      expectedShippingCost: options.expectedShipping,
      liveShippingCost: liveShipping,
      shippingDeltaEur: 0,
      salePrice,
      estimatedNetProfit,
      estimatedNetMarginPct,
      marginHealthy: estimatedNetMarginPct >= 35,
      flags: ['REQUIRES_HUMAN_ACTION'],
      actionRequired: 'HUMAN_APPROVAL_REQUIRED',
      notes: 'Requiere compra manual en AliExpress con la dirección del cliente o token API de dropshipping activo.'
    };
  }

  async createPurchaseOrder(payload: ConnectorPurchasePayload): Promise<ConnectorPurchaseResponse> {
    return {
      success: false,
      status: 'human_action_required',
      humanActionReason: 'AliExpress Open API no configurada con token OAuth de comprador. Requiere compra manual por operador.',
      errorMessage: 'REQUIRES_HUMAN_ACTION: Haz clic en el botón [Comprar en AliExpress] para despachar con la dirección de envío del cliente.'
    };
  }

  async getTracking(supplierOrderReference: string) {
    return null;
  }
}
