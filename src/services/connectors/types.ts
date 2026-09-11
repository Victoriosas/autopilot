import type { 
  ConnectorStatus, 
  ConnectorCapability, 
  SourceProduct, 
  PrePurchaseVerificationResult,
  SupplierOrder 
} from '../../types';

export interface ConnectorSearchOptions {
  category?: string;
  keyword?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  country?: string;
  limit?: number;
}

export interface ConnectorVerificationOptions {
  sourceUrl: string;
  sourceSku: string;
  expectedCost: number;
  expectedShipping: number;
  currentSalePrice: number;
  destinationCountry?: string;
}

export interface ConnectorPurchasePayload {
  supplierOrder: SupplierOrder;
  autoConfirm?: boolean;
}

export interface ConnectorPurchaseResponse {
  success: boolean;
  status: 'order_placed' | 'human_action_required' | 'failed';
  supplierReference?: string;
  totalPaidEur?: number;
  estimatedDelivery?: string;
  trackingUrl?: string;
  errorMessage?: string;
  humanActionReason?: string;
}

export interface SourceConnector {
  readonly id: string;
  readonly name: string;
  readonly platform: 'Amazon Global' | 'AliExpress Direct' | 'Alibaba Wholesale' | 'Supplier Hub B2B' | 'Direct Import';
  readonly capabilities: ConnectorCapability[];

  getStatus(): ConnectorStatus;
  getStatusReason(): string;
  isConfigured(): boolean;

  searchProducts(options: ConnectorSearchOptions): Promise<SourceProduct[]>;
  getProductByUrl(url: string): Promise<SourceProduct | null>;
  verifyAvailabilityAndPrice(options: ConnectorVerificationOptions): Promise<PrePurchaseVerificationResult>;
  createPurchaseOrder(payload: ConnectorPurchasePayload): Promise<ConnectorPurchaseResponse>;
  getTracking(supplierOrderReference: string): Promise<{ status: string; trackingNumber?: string; carrier?: string } | null>;
}
