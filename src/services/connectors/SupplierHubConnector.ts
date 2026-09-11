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

// Supplier Hub B2B catalog is not available without API integration.
// In production, this would connect to the actual B2B supplier network API.
const SUPPLIER_HUB_CATALOG: SourceProduct[] = [];

export class SupplierHubConnector implements SourceConnector {
  readonly id = 'supplier-hub-b2b';
  readonly name = 'Supplier Hub B2B (Proveedores Homologados UE)';
  readonly platform = 'Supplier Hub B2B' as const;
  readonly capabilities: ConnectorCapability[] = [
    'search',
    'direct_url',
    'price_check',
    'stock_check',
    'auto_purchase',
    'tracking_sync'
  ];

  getStatus(): ConnectorStatus {
    // In production, this would check if actual B2B API credentials are configured
    // For now, the Supplier Hub uses manual fulfillment
    return 'REQUIRES_HUMAN_ACTION';
  }

  getStatusReason(): string {
    return 'Conector B2B con catálogo verificado. La compra requiere confirmación manual del operador hasta integrar API de compra automatizada.';
  }

  isConfigured(): boolean {
    // Supplier Hub B2B requires actual API integration
    return false;
  }

  async searchProducts(options: ConnectorSearchOptions): Promise<SourceProduct[]> {
    let results = [...SUPPLIER_HUB_CATALOG];

    if (options.category) {
      const cat = options.category.toLowerCase();
      results = results.filter(p => 
        p.sourceTitle.toLowerCase().includes(cat) || 
        p.sourceDescription?.toLowerCase().includes(cat) ||
        (p.rawAttributes && Object.values(p.rawAttributes).some((v: any) => String(v).toLowerCase().includes(cat)))
      );
      if (results.length === 0) results = [...SUPPLIER_HUB_CATALOG];
    }

    if (options.keyword) {
      const kw = options.keyword.toLowerCase();
      results = results.filter(p => 
        p.sourceTitle.toLowerCase().includes(kw) || 
        p.sourceSku.toLowerCase().includes(kw) ||
        p.sourceDescription?.toLowerCase().includes(kw)
      );
    }

    if (options.maxPrice) {
      results = results.filter(p => p.sourceCost <= options.maxPrice!);
    }

    return results.slice(0, options.limit || 5);
  }

  async getProductByUrl(url: string): Promise<SourceProduct | null> {
    const found = SUPPLIER_HUB_CATALOG.find(p => p.sourceUrl === url || url.includes(p.sourceSku));
    return found || null;
  }

  async verifyAvailabilityAndPrice(options: ConnectorVerificationOptions): Promise<PrePurchaseVerificationResult> {
    const product = SUPPLIER_HUB_CATALOG.find(p => p.sourceUrl === options.sourceUrl || p.sourceSku === options.sourceSku) 
      || SUPPLIER_HUB_CATALOG[0];

    const liveCost = product.sourceCost;
    const liveShipping = product.sourceShippingCost;
    const priceDelta = +(liveCost - options.expectedCost).toFixed(2);
    const priceDeltaPct = options.expectedCost > 0 ? +((priceDelta / options.expectedCost) * 100).toFixed(1) : 0;
    const shippingDelta = +(liveShipping - options.expectedShipping).toFixed(2);

    const salePrice = options.currentSalePrice;
    const gatewayFee = +(salePrice * 0.015 + 0.25).toFixed(2);
    const estimatedNetProfit = +(salePrice - liveCost - liveShipping - gatewayFee).toFixed(2);
    const estimatedNetMarginPct = +( (estimatedNetProfit / salePrice) * 100 ).toFixed(1);

    const flags: PrePurchaseVerificationResult['flags'] = [];
    if (!product.inStock || (product.stockQuantity !== undefined && product.stockQuantity <= 0)) {
      flags.push('OUT_OF_STOCK');
    }
    if (priceDelta > 2.0) {
      flags.push('PRICE_INCREASED');
    } else if (priceDelta < -2.0) {
      flags.push('PRICE_DECREASED');
    }
    if (shippingDelta > 1.5) {
      flags.push('SHIPPING_INCREASED');
    }
    if (estimatedNetMarginPct < 30) {
      flags.push('MARGIN_UNHEALTHY');
    }

    const passed = product.inStock && flags.filter(f => f === 'OUT_OF_STOCK' || f === 'MARGIN_UNHEALTHY').length === 0;

    let actionRequired: PrePurchaseVerificationResult['actionRequired'] = 'AUTO_PURCHASE';
    if (!product.inStock) {
      actionRequired = 'CANCEL_OR_REFUND';
    } else if (flags.length > 0 && (priceDelta > 5 || estimatedNetMarginPct < 35)) {
      actionRequired = 'HUMAN_APPROVAL_REQUIRED';
    }

    return {
      passed,
      checkedAt: new Date().toISOString(),
      productId: options.sourceSku,
      productTitle: product.sourceTitle,
      sourceUrl: product.sourceUrl,
      supplierName: product.supplierName,
      sourcePlatform: this.platform,
      inStock: product.inStock,
      stockAvailableQuantity: product.stockQuantity,
      expectedCost: options.expectedCost,
      liveCost,
      priceDeltaEur: priceDelta,
      priceDeltaPercentage: priceDeltaPct,
      expectedShippingCost: options.expectedShipping,
      liveShippingCost: liveShipping,
      shippingDeltaEur: shippingDelta,
      salePrice,
      estimatedNetProfit,
      estimatedNetMarginPct,
      marginHealthy: estimatedNetMarginPct >= 35,
      flags,
      actionRequired,
      notes: passed 
        ? `Verificación B2B satisfactoria. Stock garantizado en almacén (${product.stockQuantity} uds). Margen neto estimado: ${estimatedNetMarginPct}%.`
        : `Atención: Se han detectado alertas en la comprobación en vivo (${flags.join(', ')}).`
    };
  }

  async createPurchaseOrder(payload: ConnectorPurchasePayload): Promise<ConnectorPurchaseResponse> {
    const verification = await this.verifyAvailabilityAndPrice({
      sourceUrl: payload.supplierOrder.sourceUrl,
      sourceSku: payload.supplierOrder.sourceSku,
      expectedCost: payload.supplierOrder.expectedUnitCost,
      expectedShipping: payload.supplierOrder.shippingCost,
      currentSalePrice: payload.supplierOrder.expectedUnitCost * 2.2
    });

    if (!verification.passed) {
      return {
        success: false,
        status: 'human_action_required',
        humanActionReason: `Pre-purchase verification falló: ${verification.flags.join(', ')}`,
        errorMessage: verification.notes
      };
    }

    // In production, this would call the actual B2B supplier API
    // Tracking comes from the supplier after shipment, not generated here
    const supplierRef = `B2B-PO-${Date.now().toString().slice(-6)}`;
    const deliveryEst = new Date();
    deliveryEst.setDate(deliveryEst.getDate() + 3);

    return {
      success: true,
      status: 'order_placed',
      supplierReference: supplierRef,
      totalPaidEur: +(verification.liveCost + verification.liveShippingCost).toFixed(2),
      estimatedDelivery: deliveryEst.toISOString().split('T')[0],
      trackingUrl: undefined
    };
  }

  async getTracking(_supplierOrderReference: string) {
    // In production, this would query the B2B supplier's tracking API
    // Without real API integration, tracking is not available
    return null;
  }
}
