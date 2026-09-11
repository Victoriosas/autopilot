export type ProductStatus =
  | 'discovered'
  | 'analyzing'
  | 'validated'
  | 'ready_for_review'
  | 'approved'
  | 'draft_ready'
  | 'published'
  | 'rejected';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ScoreTier = 'S' | 'A' | 'B' | 'C' | 'D';

export interface TraceabilitySource {
  name: string;
  url: string;
  platform: 'Amazon Global' | 'AliExpress Direct' | 'Trendyol Select' | 'Wholesale Hub' | 'Artisan Feed' | 'Manual Discovery';
  sku: string;
  rating: number;
  rawCategory: string;
}

export interface TraceabilitySupplier {
  name: string;
  reliabilityScore: number; // 0 - 100
  country: string;
  shippingDaysMin: number;
  shippingDaysMax: number;
  returnPolicy: string;
}

export interface TraceabilityPricing {
  originalCostEur: number;
  originalCurrency: string;
  supplierShippingCost: number;
  estimatedCustoms: number;
  gatewayFee: number;
  targetMarginPct: number;
  suggestedPrice: number;
  retailPrice: number;
  potentialProfit: number;
  psychologicalEnding: string;
  checkoutCurrency?: string;
  exchangeRate?: number;
  priceUsd?: number;
}

export interface TraceabilityAnalysis {
  demandScore: number; // 0 - 100
  competitionLevel: 'low' | 'medium' | 'high';
  marginPotential: number; // 0 - 100
  brandFitScore: number; // 0 - 100
  brandFitJustification: string;
  qualityScore: number; // 0 - 100
  logisticsScore: number; // 0 - 100
  overallScore: number; // 0 - 100
  scoreTier: ScoreTier;
  targetAudience: string;
  keySellingPoints: string[];
  validatedClaims: string[];
  potentialIssues: string[];
}

export interface TraceabilityRisk {
  level: RiskLevel;
  copyrightRisk: 'none' | 'low' | 'medium' | 'high';
  claimsRisk: 'safe' | 'needs_disclaimer' | 'prohibited';
  supplierRisk: 'safe' | 'moderate' | 'unverified';
  returnRisk: 'low' | 'medium' | 'high';
  details: string[];
}

export interface TraceabilityHistoryEntry {
  timestamp: string;
  stage: string;
  fromStatus?: ProductStatus;
  toStatus?: ProductStatus;
  action: string;
  actor: string;
  notes?: string;
}

export interface Traceability {
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  source: TraceabilitySource;
  supplier: TraceabilitySupplier;
  pricing: TraceabilityPricing;
  analysis: TraceabilityAnalysis;
  risk: TraceabilityRisk;
  history: TraceabilityHistoryEntry[];
}

export interface ProductVariant {
  id: string;
  name: string;
  options: string[];
}

export interface ImageEnhancementOptions {
  targetWidth?: number;
  targetHeight?: number;
  aspectRatio?: '1:1' | '4:5' | '16:9';
  fit?: 'cover' | 'contain_padded';
  removeBackground?: boolean;
  studioLighting?: boolean;
  studioBackdrop?: 'dark_studio' | 'minimal_white' | 'frosted_glass' | 'warm_ambient' | 'warm_sand' | 'transparent';
  brightness?: number; // -50 to 50
  contrast?: number; // -50 to 50
  saturation?: number; // -50 to 50
  sharpness?: number; // 0 to 100
  vignette?: number; // 0 to 100
  colorCorrection?: boolean;
  watermark?: 'none' | 'subtle' | 'victoriosa_badge';
}

export interface EnhancedImageResult {
  id: string;
  originalUrl: string;
  enhancedUrl: string;
  storagePath?: string;
  storageUrl?: string;
  processedAt: string;
  dimensions: { width: number; height: number };
  aspectRatio: string;
  appliedFilters: string[];
  fileSizeEstimated?: string;
}

export interface Product {
  id: string;
  status: ProductStatus;
  rejectionReason?: string;
  title: string;
  originalTitle: string;
  subtitle?: string;
  slug: string;
  category: string;
  subCategory?: string;
  tags: string[];
  brand: 'Victoriosa';
  description: string;
  originalDescription?: string;
  features: string[];
  specs: Record<string, string>;
  images: string[];
  originalImages: string[];
  imageEnhancements?: EnhancedImageResult[];
  isImageEnhanced?: boolean;
  price: number;
  compareAtPrice?: number;
  costPrice: number;
  inventory: number;
  sku: string;
  supplierId?: string;
  variants?: ProductVariant[];
  badges: string[];
  rating: number;
  reviewCount: number;
  traceability: Traceability;
}

export interface VolumeTierDiscount {
  minUnits: number;
  discountPct: number;
}

export interface SupplierContact {
  representative?: string;
  contactName?: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  website?: string;
  warehouseLocations?: string[];
}

export interface SupplierCatalog {
  categories: string[];
  brandNames?: string[];
  totalSkus?: number;
  productCount?: number;
  leadTimeDays?: number;
  minOrderQty?: number;
  inventoryStatus?: 'high' | 'medium' | 'low' | 'on_demand';
  catalogUrl?: string;
}

export interface SupplierPricingAgreements {
  currency: string;
  paymentTerms: string;
  moq?: number;
  leadTimeDaysMin?: number;
  leadTimeDaysMax?: number;
  baseDiscountPct: number;
  volumeTiers?: VolumeTierDiscount[];
  avgShippingPerUnit: number;
  returnAgreement: string;
  contractExpiresAt?: string;
}

export interface SupplierMetrics {
  reliabilityScore: number; // 0 - 100
  fulfillmentRate: number; // 0 - 100
  defectRate: number; // 0 - 100
  avgDispatchDays: number;
  auditStatus?: 'verified' | 'certified_iso9001' | 'pending_audit' | 'under_review';
  totalOrdersPlaced?: number;
  lastOrderDate?: string;
}

export type SupplierType = 'manufacturer' | 'authorized_distributor' | 'artisan_workshop' | 'direct_wholesaler';
export type SupplierStatus = 'active' | 'under_review' | 'inactive' | 'evaluating' | 'restricted';
export type StockAvailabilityStatus = 'in_stock' | 'on_demand' | 'limited' | 'backorder';

export interface Supplier {
  id: string;
  name: string;
  code: string;
  supplierType?: SupplierType;
  status: SupplierStatus;
  stockAvailability?: StockAvailabilityStatus;
  contact: SupplierContact;
  catalogs: SupplierCatalog;
  pricingAgreements: SupplierPricingAgreements;
  metrics: SupplierMetrics;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AutopilotLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  productId?: string;
  stage?: string;
}

export interface AutopilotRun {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed';
  trigger: 'manual' | 'scheduled' | 'batch_scan' | 'single_pipeline';
  itemsFound: number;
  itemsProcessed: number;
  itemsApproved: number;
  itemsPublished: number;
  itemsRejected: number;
  durationSeconds: number;
  logs: AutopilotLog[];
}

export interface AutopilotSettings {
  autoApproveScoreThreshold: number;
  maxRiskLevelAllowed: RiskLevel;
  minMarginPercentage: number;
  autoPublishApproved: boolean;
  brandTone: 'luxury_lifestyle' | 'modern_minimalist' | 'premium_tech' | 'curated_artisan';
  activeSources: string[];
  blacklistedKeywords: string[];
  targetCategories: string[];
  defaultCurrency: string;
  autoDiscoveryIntervalHours: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedVariant?: string;
}

export interface OrderCustomer {
  name?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  address: string;
  city: string;
  postalCode: string;
  province?: string;
  country: string;
}

export interface OrderItem {
  productId: string;
  title: string;
  price: number;
  quantity: number;
  image: string;
  selectedVariant?: string;
  sku: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customer: OrderCustomer;
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  discount: number;
  total: number;
  currency: string;
  paymentMethod: 'paypal';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled' | 'expired';
  paymentId?: string;
  paymentGateway?: 'paypal';
  status: 'pending_payment' | 'confirmed' | 'preparing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  trackingNumber: string;
  estimatedDelivery: string;
  createdAt: string;
  userId?: string;
}

export type ConnectorStatus =
  | 'IMPLEMENTED'
  | 'NOT_CONFIGURED'
  | 'REQUIRES_CREDENTIALS'
  | 'REQUIRES_HUMAN_ACTION'
  | 'NOT_SUPPORTED';

export type ConnectorCapability =
  | 'search'
  | 'direct_url'
  | 'price_check'
  | 'stock_check'
  | 'auto_purchase'
  | 'manual_purchase'
  | 'tracking_sync';

export interface SourceConnectorConfig {
  id: string;
  name: string;
  platform: 'Amazon Global' | 'AliExpress Direct' | 'Alibaba Wholesale' | 'Supplier Hub B2B' | 'Direct Import';
  status: ConnectorStatus;
  statusReason?: string;
  capabilities: ConnectorCapability[];
  apiKeyConfigured: boolean;
  endpointUrl?: string;
  defaultCurrency: string;
  rateLimitPerMinute: number;
  lastCheckedAt?: string;
}

export interface SourceProduct {
  id: string;
  connectorId: string;
  platform: string;
  sourceUrl: string;
  sourceSku: string;
  sourceTitle: string;
  sourceDescription?: string;
  sourceImages: string[];
  sourceCost: number;
  sourceCurrency: string;
  sourceShippingCost: number;
  estimatedDeliveryDaysMin: number;
  estimatedDeliveryDaysMax: number;
  inStock: boolean;
  stockQuantity?: number;
  supplierName: string;
  supplierCountry: string;
  supplierRating?: number;
  rawAttributes?: Record<string, any>;
  lastVerifiedAt: string;
  status: 'raw' | 'analyzing' | 'converted_to_candidate' | 'rejected';
}

export interface PrePurchaseVerificationResult {
  passed: boolean;
  checkedAt: string;
  productId: string;
  productTitle: string;
  sourceUrl: string;
  supplierId?: string;
  supplierName: string;
  sourcePlatform: string;
  inStock: boolean;
  stockAvailableQuantity?: number;
  expectedCost: number;
  liveCost: number;
  priceDeltaEur: number;
  priceDeltaPercentage: number;
  expectedShippingCost: number;
  liveShippingCost: number;
  shippingDeltaEur: number;
  salePrice: number;
  estimatedNetProfit: number;
  estimatedNetMarginPct: number;
  marginHealthy: boolean;
  flags: Array<'PRICE_INCREASED' | 'PRICE_DECREASED' | 'OUT_OF_STOCK' | 'SHIPPING_INCREASED' | 'DELIVERY_DELAYED' | 'MARGIN_UNHEALTHY' | 'REQUIRES_HUMAN_ACTION' | 'UNVERIFIED_STOCK'>;
  actionRequired: 'AUTO_PURCHASE' | 'HUMAN_APPROVAL_REQUIRED' | 'CANCEL_OR_REFUND';
  notes: string;
}

export type SupplierOrderStatus =
  | 'pending_verification'
  | 'verification_passed'
  | 'verification_failed'
  | 'human_action_required'
  | 'ready_to_order'
  | 'order_placed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export interface SupplierOrder {
  id: string;
  orderId: string; // Linked customer order ID
  orderNumber?: string;
  productId: string;
  productTitle: string;
  productSku: string;
  quantity: number;
  selectedVariant?: string;
  customerShippingAddress: OrderCustomer;
  supplierId?: string;
  supplierName: string;
  sourcePlatform: string;
  sourceUrl: string;
  sourceSku: string;
  expectedUnitCost?: number;
  actualUnitCost?: number;
  unitCostEur?: number;
  shippingCost?: number;
  shippingCostEur?: number;
  totalSupplierCost?: number;
  totalCostEur?: number;
  salePriceEur?: number;
  totalRevenueEur?: number;
  estimatedMarginPct?: number;
  currency?: string;
  status: SupplierOrderStatus;
  statusMessage?: string;
  verification?: PrePurchaseVerificationResult;
  prePurchaseVerification?: PrePurchaseVerificationResult;
  supplierOrderReference?: string;
  trackingNumber?: string;
  carrier?: string;
  trackingUrl?: string;
  orderedAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  humanActionReason?: string;
  manualPurchaseNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export type AlertType =
  | 'PRICE_CHANGED'
  | 'OUT_OF_STOCK'
  | 'SHIPPING_CHANGED'
  | 'DELIVERY_CHANGED'
  | 'PURCHASE_REQUIRES_HUMAN'
  | 'PURCHASE_FAILED'
  | 'CONNECTOR_ERROR'
  | 'AUTOPILOT_RUN_FINISHED'
  | 'SECURITY_NOTICE';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface SystemAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  entityId?: string;
  entityType?: 'product' | 'order' | 'supplier_order' | 'supplier' | 'connector' | 'autopilot_run';
  productId?: string;
  productTitle?: string;
  supplierOrderId?: string;
  sourcePlatform?: string;
  actionLink?: string;
  data?: Record<string, any>;
  status?: 'unread' | 'resolved' | 'dismissed';
  resolved?: boolean;
  dismissed?: boolean;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'customer';
  savedAddresses?: Array<OrderCustomer & { id: string; label: string }>;
  wishlist?: string[];
}
