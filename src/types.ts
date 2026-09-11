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

// ============================================================
// Supabase Database Types (generated from schema)
// ============================================================
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          role: 'customer' | 'admin' | 'operator';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          role?: 'customer' | 'admin' | 'operator';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          role?: 'customer' | 'admin' | 'operator';
          created_at?: string;
          updated_at?: string;
        };
      };
      products: {
        Row: {
          id: string;
          title: string;
          slug: string | null;
          subtitle: string | null;
          description: string | null;
          original_title: string | null;
          category: string | null;
          sub_category: string | null;
          brand: string;
          sku: string | null;
          price: number;
          compare_at_price: number | null;
          cost_price: number | null;
          inventory: number;
          rating: number | null;
          review_count: number;
          status: string;
          rejection_reason: string | null;
          tags: any;
          badges: any;
          features: any;
          specs: any;
          images: string[];
          original_images: string[];
          image_enhancements: any;
          is_image_enhanced: boolean;
          variants: any;
          supplier_id: string | null;
          traceability: any;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          slug?: string | null;
          subtitle?: string | null;
          description?: string | null;
          original_title?: string | null;
          category?: string | null;
          sub_category?: string | null;
          brand?: string;
          sku?: string | null;
          price: number;
          compare_at_price?: number | null;
          cost_price?: number | null;
          inventory?: number;
          rating?: number | null;
          review_count?: number;
          status?: string;
          rejection_reason?: string | null;
          tags?: any;
          badges?: any;
          features?: any;
          specs?: any;
          images?: string[];
          original_images?: string[];
          image_enhancements?: any;
          is_image_enhanced?: boolean;
          variants?: any;
          supplier_id?: string | null;
          traceability?: any;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          slug?: string | null;
          subtitle?: string | null;
          description?: string | null;
          original_title?: string | null;
          category?: string | null;
          sub_category?: string | null;
          brand?: string;
          sku?: string | null;
          price?: number;
          compare_at_price?: number | null;
          cost_price?: number | null;
          inventory?: number;
          rating?: number | null;
          review_count?: number;
          status?: string;
          rejection_reason?: string | null;
          tags?: any;
          badges?: any;
          features?: any;
          specs?: any;
          images?: string[];
          original_images?: string[];
          image_enhancements?: any;
          is_image_enhanced?: boolean;
          variants?: any;
          supplier_id?: string | null;
          traceability?: any;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      suppliers: {
        Row: {
          id: string;
          name: string;
          code: string;
          supplier_type: string;
          status: string;
          stock_availability: string;
          contact: any;
          catalogs: any;
          pricing_agreements: any;
          metrics: any;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          supplier_type?: string;
          status?: string;
          stock_availability?: string;
          contact?: any;
          catalogs?: any;
          pricing_agreements?: any;
          metrics?: any;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          code?: string;
          supplier_type?: string;
          status?: string;
          stock_availability?: string;
          contact?: any;
          catalogs?: any;
          pricing_agreements?: any;
          metrics?: any;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          user_id: string | null;
          customer_email: string | null;
          customer_name: string | null;
          customer_phone: string | null;
          customer_address: string | null;
          customer_city: string | null;
          customer_postal_code: string | null;
          customer_country: string | null;
          items: any;
          subtotal: number;
          shipping_cost: number;
          discount: number;
          total: number;
          currency: string;
          payment_method: string;
          payment_status: string;
          payment_id: string | null;
          payment_gateway: string | null;
          status: string;
          tracking_number: string | null;
          estimated_delivery: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_number: string;
          user_id?: string | null;
          customer_email?: string | null;
          customer_name?: string | null;
          customer_phone?: string | null;
          customer_address?: string | null;
          customer_city?: string | null;
          customer_postal_code?: string | null;
          customer_country?: string | null;
          items?: any;
          subtotal?: number;
          shipping_cost?: number;
          discount?: number;
          total?: number;
          currency?: string;
          payment_method?: string;
          payment_status?: string;
          payment_id?: string | null;
          payment_gateway?: string | null;
          status?: string;
          tracking_number?: string | null;
          estimated_delivery?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_number?: string;
          user_id?: string | null;
          customer_email?: string | null;
          customer_name?: string | null;
          customer_phone?: string | null;
          customer_address?: string | null;
          customer_city?: string | null;
          customer_postal_code?: string | null;
          customer_country?: string | null;
          items?: any;
          subtotal?: number;
          shipping_cost?: number;
          discount?: number;
          total?: number;
          currency?: string;
          payment_method?: string;
          payment_status?: string;
          payment_id?: string | null;
          payment_gateway?: string | null;
          status?: string;
          tracking_number?: string | null;
          estimated_delivery?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      supplier_orders: {
        Row: {
          id: string;
          order_id: string | null;
          product_id: string | null;
          supplier_id: string | null;
          product_title: string | null;
          product_sku: string | null;
          quantity: number;
          selected_variant: string | null;
          source_platform: string | null;
          source_url: string | null;
          source_sku: string | null;
          supplier_name: string | null;
          unit_cost_eur: number | null;
          shipping_cost_eur: number | null;
          total_cost_eur: number | null;
          sale_price_eur: number | null;
          total_revenue_eur: number | null;
          estimated_margin_pct: number | null;
          status: string;
          supplier_order_reference: string | null;
          tracking_number: string | null;
          carrier: string | null;
          tracking_url: string | null;
          human_action_reason: string | null;
          manual_purchase_notes: string | null;
          verification: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id?: string | null;
          product_id?: string | null;
          supplier_id?: string | null;
          product_title?: string | null;
          product_sku?: string | null;
          quantity?: number;
          selected_variant?: string | null;
          source_platform?: string | null;
          source_url?: string | null;
          source_sku?: string | null;
          supplier_name?: string | null;
          unit_cost_eur?: number | null;
          shipping_cost_eur?: number | null;
          total_cost_eur?: number | null;
          sale_price_eur?: number | null;
          total_revenue_eur?: number | null;
          estimated_margin_pct?: number | null;
          status?: string;
          supplier_order_reference?: string | null;
          tracking_number?: string | null;
          carrier?: string | null;
          tracking_url?: string | null;
          human_action_reason?: string | null;
          manual_purchase_notes?: string | null;
          verification?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string | null;
          product_id?: string | null;
          supplier_id?: string | null;
          product_title?: string | null;
          product_sku?: string | null;
          quantity?: number;
          selected_variant?: string | null;
          source_platform?: string | null;
          source_url?: string | null;
          source_sku?: string | null;
          supplier_name?: string | null;
          unit_cost_eur?: number | null;
          shipping_cost_eur?: number | null;
          total_cost_eur?: number | null;
          sale_price_eur?: number | null;
          total_revenue_eur?: number | null;
          estimated_margin_pct?: number | null;
          status?: string;
          supplier_order_reference?: string | null;
          tracking_number?: string | null;
          carrier?: string | null;
          tracking_url?: string | null;
          human_action_reason?: string | null;
          manual_purchase_notes?: string | null;
          verification?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
      autopilot_runs: {
        Row: {
          id: string;
          run_number: number;
          status: string;
          trigger_type: string;
          category: string | null;
          items_found: number;
          items_processed: number;
          items_approved: number;
          items_published: number;
          items_rejected: number;
          duration_seconds: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          run_number?: number;
          status?: string;
          trigger_type?: string;
          category?: string | null;
          items_found?: number;
          items_processed?: number;
          items_approved?: number;
          items_published?: number;
          items_rejected?: number;
          duration_seconds?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          run_number?: number;
          status?: string;
          trigger_type?: string;
          category?: string | null;
          items_found?: number;
          items_processed?: number;
          items_approved?: number;
          items_published?: number;
          items_rejected?: number;
          duration_seconds?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      autopilot_run_logs: {
        Row: {
          id: string;
          run_id: string | null;
          level: string;
          message: string;
          product_id: string | null;
          stage: string | null;
          metadata: any;
          created_at: string;
        };
        Insert: {
          id?: string;
          run_id?: string | null;
          level?: string;
          message: string;
          product_id?: string | null;
          stage?: string | null;
          metadata?: any;
          created_at?: string;
        };
        Update: {
          id?: string;
          run_id?: string | null;
          level?: string;
          message?: string;
          product_id?: string | null;
          stage?: string | null;
          metadata?: any;
          created_at?: string;
        };
      };
      product_analysis: {
        Row: {
          id: string;
          product_id: string | null;
          demand_score: number | null;
          competition_level: string | null;
          margin_potential: number | null;
          brand_fit_score: number | null;
          brand_fit_justification: string | null;
          quality_score: number | null;
          logistics_score: number | null;
          overall_score: number | null;
          score_tier: string | null;
          target_audience: string | null;
          key_selling_points: any;
          validated_claims: any;
          potential_issues: any;
          risk_level: string;
          copyright_risk: string;
          claims_risk: string;
          supplier_risk: string;
          return_risk: string;
          risk_details: any;
          analysis_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id?: string | null;
          demand_score?: number | null;
          competition_level?: string | null;
          margin_potential?: number | null;
          brand_fit_score?: number | null;
          brand_fit_justification?: string | null;
          quality_score?: number | null;
          logistics_score?: number | null;
          overall_score?: number | null;
          score_tier?: string | null;
          target_audience?: string | null;
          key_selling_points?: any;
          validated_claims?: any;
          potential_issues?: any;
          risk_level?: string;
          copyright_risk?: string;
          claims_risk?: string;
          supplier_risk?: string;
          return_risk?: string;
          risk_details?: any;
          analysis_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string | null;
          demand_score?: number | null;
          competition_level?: string | null;
          margin_potential?: number | null;
          brand_fit_score?: number | null;
          brand_fit_justification?: string | null;
          quality_score?: number | null;
          logistics_score?: number | null;
          overall_score?: number | null;
          score_tier?: string | null;
          target_audience?: string | null;
          key_selling_points?: any;
          validated_claims?: any;
          potential_issues?: any;
          risk_level?: string;
          copyright_risk?: string;
          claims_risk?: string;
          supplier_risk?: string;
          return_risk?: string;
          risk_details?: any;
          analysis_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          event_type: string;
          entity_type: string | null;
          entity_id: string | null;
          user_id: string | null;
          old_values: any;
          new_values: any;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type: string;
          entity_type?: string | null;
          entity_id?: string | null;
          user_id?: string | null;
          old_values?: any;
          new_values?: any;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_type?: string;
          entity_type?: string | null;
          entity_id?: string | null;
          user_id?: string | null;
          old_values?: any;
          new_values?: any;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
      };
      alerts: {
        Row: {
          id: string;
          alert_type: string;
          severity: string;
          title: string | null;
          message: string | null;
          product_id: string | null;
          supplier_order_id: string | null;
          source_platform: string | null;
          action_link: string | null;
          resolved: boolean;
          dismissed: boolean;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          alert_type: string;
          severity?: string;
          title?: string | null;
          message?: string | null;
          product_id?: string | null;
          supplier_order_id?: string | null;
          source_platform?: string | null;
          action_link?: string | null;
          resolved?: boolean;
          dismissed?: boolean;
          resolved_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          alert_type?: string;
          severity?: string;
          title?: string | null;
          message?: string | null;
          product_id?: string | null;
          supplier_order_id?: string | null;
          source_platform?: string | null;
          action_link?: string | null;
          resolved?: boolean;
          dismissed?: boolean;
          resolved_at?: string | null;
          created_at?: string;
        };
      };
      settings: {
        Row: {
          id: string;
          key: string;
          value: any;
          description: string | null;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          value?: any;
          description?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          value?: any;
          description?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
      };
      feature_flags: {
        Row: {
          id: string;
          flag_name: string;
          enabled: boolean;
          description: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          flag_name: string;
          enabled?: boolean;
          description?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          flag_name?: string;
          enabled?: boolean;
          description?: string | null;
          updated_at?: string;
        };
      };
    };
    Views: {
      published_products: {
        Row: {
          id: string;
          title: string;
          slug: string | null;
          subtitle: string | null;
          category: string | null;
          sub_category: string | null;
          brand: string;
          price: number;
          compare_at_price: number | null;
          images: string[];
          rating: number | null;
          review_count: number;
          tags: any;
          badges: any;
          features: any;
          specs: any;
          inventory: number;
          overall_score: number | null;
          score_tier: string | null;
          demand_score: number | null;
          risk_level: string;
        };
      };
      recent_orders: {
        Row: {
          id: string;
          order_number: string;
          customer_name: string | null;
          customer_email: string | null;
          total: number;
          currency: string;
          payment_status: string;
          status: string;
          tracking_number: string | null;
          created_at: string;
        };
      };
      autopilot_stats: {
        Row: {
          total_runs: number;
          completed_runs: number;
          failed_runs: number;
          total_items_found: number;
          total_items_approved: number;
          total_items_published: number;
          total_items_rejected: number;
          avg_duration_seconds: number;
        };
      };
    };
  };
};
