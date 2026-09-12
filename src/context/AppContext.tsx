// @ts-nocheck
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import supabase from '../lib/supabase';
import { apiFetch } from '../lib/api';
import type { User } from '@supabase/supabase-js';
import { INITIAL_PRODUCTS, INITIAL_RUNS } from '../data/initialProducts';
import { INITIAL_SUPPLIERS } from '../data/initialSuppliers';
import { enhanceAndPersistProductImage } from '../lib/imageEnhancer';
import type {
  Product,
  ProductStatus,
  AutopilotRun,
  AutopilotSettings,
  Order,
  CartItem,
  UserProfile,
  AutopilotLog,
  Supplier,
  ImageEnhancementOptions,
  EnhancedImageResult,
  SupplierOrder,
  SystemAlert,
  SourceConnectorConfig,
  PrePurchaseVerificationResult
} from '../types';

const DEFAULT_SETTINGS: AutopilotSettings = {
  autoApproveScoreThreshold: 85,
  maxRiskLevelAllowed: 'medium',
  minMarginPercentage: 45,
  autoPublishApproved: true,
  brandTone: 'luxury_lifestyle',
  activeSources: ['Amazon Global', 'AliExpress Direct', 'Trendyol Select', 'Wholesale Hub', 'Artisan Feed'],
  blacklistedKeywords: ['fake', 'replica', 'imitation', 'cure', 'medical', 'miracle', 'toxic', 'unauthorized'],
  targetCategories: ['TecnologÃ­a & Gadgets', 'Hogar & DiseÃ±o', 'Moda & Accesorios', 'Belleza & Bienestar', 'Fitness & Outdoor'],
  defaultCurrency: 'EUR (â‚¬)',
  autoDiscoveryIntervalHours: 6
};

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, m => '_' + m.toLowerCase());
}

function convertKeysToSnakeCase(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(convertKeysToSnakeCase);
  if (typeof obj !== 'object') return obj;
  const result: any = {};
  for (const key of Object.keys(obj)) {
    const snakeKey = toSnakeCase(key);
    let val = obj[key];
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      val = convertKeysToSnakeCase(val);
    }
    result[snakeKey] = val;
  }
  return result;
}

function supabaseRowToProduct(row: any): Product {
  const specs = row.specs && typeof row.specs === 'object' && !Array.isArray(row.specs)
    ? Object.fromEntries(Object.entries(row.specs).map(([k, v]) => [k.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase()), v]))
    : row.specs || {};
  return {
    id: row.id,
    status: row.status,
    rejectionReason: row.rejection_reason,
    title: row.title,
    originalTitle: row.original_title || row.title,
    subtitle: row.subtitle,
    slug: row.slug || '',
    category: row.category || '',
    subCategory: row.sub_category,
    tags: row.tags || [],
    brand: row.brand || 'Victoriosa',
    description: row.description || '',
    originalDescription: row.original_description,
    features: row.features || [],
    specs,
    images: row.images || [],
    originalImages: row.original_images || [],
    imageEnhancements: row.image_enhancements,
    isImageEnhanced: row.is_image_enhanced,
    price: row.price || 0,
    compareAtPrice: row.compare_at_price,
    costPrice: row.cost_price || 0,
    inventory: row.inventory || 0,
    sku: row.sku || '',
    supplierId: row.supplier_id,
    variants: row.variants,
    badges: row.badges || [],
    rating: row.rating || 0,
    reviewCount: row.review_count || 0,
    traceability: row.traceability || {
      createdBy: 'Supabase Migration',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: { name: '', url: '', platform: 'Manual Discovery' as any, sku: '', rating: 0, rawCategory: '' },
      supplier: { name: '', reliabilityScore: 0, country: '', shippingDaysMin: 0, shippingDaysMax: 0, returnPolicy: '' },
      pricing: { originalCostEur: 0, originalCurrency: 'EUR', supplierShippingCost: 0, estimatedCustoms: 0, gatewayFee: 0, targetMarginPct: 0, suggestedPrice: 0, retailPrice: 0, potentialProfit: 0, psychologicalEnding: '95' },
      analysis: { demandScore: 0, competitionLevel: 'low', marginPotential: 0, brandFitScore: 0, brandFitJustification: '', qualityScore: 0, logisticsScore: 0, overallScore: 0, scoreTier: 'C', targetAudience: '', keySellingPoints: [], validatedClaims: [], potentialIssues: [] },
      risk: { level: 'low', copyrightRisk: 'none', claimsRisk: 'safe', supplierRisk: 'safe', returnRisk: 'low', details: [] },
      history: []
    }
  };
}

function productToSupabaseRow(product: Product): any {
  const row: any = {
    id: product.id,
    status: product.status,
    rejection_reason: product.rejectionReason,
    title: product.title,
    original_title: product.originalTitle,
    subtitle: product.subtitle,
    slug: product.slug,
    category: product.category,
    sub_category: product.subCategory,
    tags: product.tags,
    brand: product.brand,
    description: product.description,
    original_description: product.originalDescription,
    features: product.features,
    specs: product.specs,
    images: product.images,
    original_images: product.originalImages,
    image_enhancements: product.imageEnhancements,
    is_image_enhanced: product.isImageEnhanced || false,
    price: product.price,
    compare_at_price: product.compareAtPrice,
    cost_price: product.costPrice,
    inventory: product.inventory,
    sku: product.sku,
    supplier_id: product.supplierId,
    variants: product.variants,
    badges: product.badges,
    rating: product.rating,
    review_count: product.reviewCount,
    traceability: convertKeysToSnakeCase(product.traceability),
    updated_at: new Date().toISOString()
  };
  return row;
}

function supabaseRowToSupplier(row: any): Supplier {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    supplierType: row.supplier_type,
    status: row.status,
    stockAvailability: row.stock_availability,
    contact: row.contact || {},
    catalogs: row.catalogs || {},
    pricingAgreements: row.pricing_agreements || {},
    metrics: row.metrics || {},
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function supplierToSupabaseRow(supplier: Supplier): any {
  return {
    id: supplier.id,
    name: supplier.name,
    code: supplier.code,
    supplier_type: supplier.supplierType,
    status: supplier.status,
    stock_availability: supplier.stockAvailability,
    contact: supplier.contact,
    catalogs: supplier.catalogs,
    pricing_agreements: supplier.pricingAgreements,
    metrics: supplier.metrics,
    notes: supplier.notes,
    updated_at: new Date().toISOString()
  };
}

function supabaseRowToOrder(row: any): Order {
  return {
    id: row.id,
    orderNumber: row.order_number,
    customer: {
      name: row.customer_name,
      fullName: row.customer_name,
      email: row.customer_email,
      phone: row.customer_phone,
      address: row.customer_address || '',
      city: row.customer_city || '',
      postalCode: row.customer_postal_code || '',
      country: row.customer_country || 'EspaÃ±a'
    },
    items: row.items || [],
    subtotal: row.subtotal || 0,
    shippingCost: row.shipping_cost || 0,
    discount: row.discount || 0,
    total: row.total || 0,
    currency: row.currency || 'USD',
    paymentMethod: row.payment_method || 'paypal',
    paymentStatus: row.payment_status || 'pending',
    paymentId: row.payment_id,
    paymentGateway: row.payment_gateway,
    status: row.status || 'pending_payment',
    trackingNumber: row.tracking_number || '',
    estimatedDelivery: row.estimated_delivery || '',
    createdAt: row.created_at,
    userId: row.user_id
  };
}

function supabaseRowToSupplierOrder(row: any): SupplierOrder {
  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id,
    productTitle: row.product_title || '',
    productSku: row.product_sku || '',
    quantity: row.quantity || 1,
    selectedVariant: row.selected_variant,
    sourcePlatform: row.source_platform || '',
    sourceUrl: row.source_url || '',
    sourceSku: row.source_sku || '',
    supplierName: row.supplier_name || '',
    unitCostEur: row.unit_cost_eur,
    shippingCostEur: row.shipping_cost_eur,
    totalCostEur: row.total_cost_eur,
    salePriceEur: row.sale_price_eur,
    totalRevenueEur: row.total_revenue_eur,
    estimatedMarginPct: row.estimated_margin_pct,
    status: row.status || 'pending_verification',
    supplierOrderReference: row.supplier_order_reference,
    trackingNumber: row.tracking_number,
    carrier: row.carrier,
    humanActionReason: row.human_action_reason,
    prePurchaseVerification: row.verification,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function supabaseRowToAlert(row: any): SystemAlert {
  return {
    id: row.id,
    type: row.alert_type,
    severity: row.severity || 'info',
    title: row.title || '',
    message: row.message || '',
    productId: row.product_id,
    supplierOrderId: row.supplier_order_id,
    sourcePlatform: row.source_platform,
    actionLink: row.action_link,
    resolved: row.resolved || false,
    dismissed: row.dismissed || false,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at
  };
}

function settingsToDbRow(settings: AutopilotSettings): any {
  return {
    key: 'autopilot_config',
    value: settings,
    updated_at: new Date().toISOString()
  };
}

interface AppContextType {
  viewMode: 'store' | 'admin';
  setViewMode: (mode: 'store' | 'admin') => void;
  userRole: 'admin' | 'customer';
  setUserRole: (role: 'admin' | 'customer') => void;
  user: User | null;
  userProfile: UserProfile | null;
  isAuthLoading: boolean;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name?: string, roleChoice?: 'admin' | 'customer') => Promise<void>;
  signOutUser: () => Promise<void>;
  products: Product[];
  publishedProducts: Product[];
  candidateProducts: Product[];
  runs: AutopilotRun[];
  settings: AutopilotSettings;
  suppliers: Supplier[];
  orders: Order[];
  supplierOrders: SupplierOrder[];
  alerts: SystemAlert[];
  connectors: SourceConnectorConfig[];
  unreadAlertsCount: number;
  cart: CartItem[];
  wishlist: string[];
  selectedProduct: Product | null;
  setSelectedProduct: (p: Product | null) => void;
  selectedCandidateForReview: Product | null;
  setSelectedCandidateForReview: (p: Product | null) => void;
  isLoading: boolean;
  isAutopilotRunning: boolean;
  activeLogs: string[];
  autopilotLiveLogs: AutopilotLog[];
  runPipelineOnCandidate: (candidate: Product) => Promise<Product | null>;
  discoverNewCandidates: (category?: string, source?: string, keyword?: string) => Promise<void>;
  discoverProducts: (category?: string, source?: string, count?: number, keyword?: string) => Promise<void>;
  importProductFromUrl: (url: string) => Promise<Product | null>;
  triggerFullAutopilotRun: (category?: string, source?: string) => Promise<void>;
  runFullAutopilotBatch: (params: { category?: string; maxCandidates?: number; autoPublishApproved?: boolean; targetMarginPct?: number }) => Promise<void>;
  approveProduct: (productId: string, autoPublish?: boolean) => Promise<void>;
  publishProduct: (productId: string) => Promise<void>;
  unpublishProduct: (productId: string) => Promise<void>;
  rejectProduct: (productId: string, reason: string) => Promise<void>;
  saveProductEdits: (product: Product) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  updateSettings: (newSettings: Partial<AutopilotSettings>) => Promise<void>;
  resetToInitialData: () => Promise<void>;
  performPrePurchaseVerification: (productId: string, supplierOrderId?: string) => Promise<PrePurchaseVerificationResult | null>;
  executeSupplierPurchase: (supplierOrderId: string) => Promise<void>;
  markSupplierOrderAsManualBought: (supplierOrderId: string, notes?: string, trackingNumber?: string, carrier?: string) => Promise<void>;
  updateSupplierOrderTracking: (supplierOrderId: string, trackingNumber: string, carrier: string) => Promise<void>;
  cancelSupplierOrder: (supplierOrderId: string, reason: string) => Promise<void>;
  resolveAlert: (alertId: string) => Promise<void>;
  dismissAlert: (alertId: string) => Promise<void>;
  createSystemAlert: (alertData: Omit<SystemAlert, 'id' | 'createdAt'>) => Promise<void>;
  addSupplier: (supplierData: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Supplier>;
  updateSupplier: (supplier: Supplier) => Promise<void>;
  deleteSupplier: (supplierId: string) => Promise<void>;
  assignSupplierToProduct: (productId: string, supplierId: string) => Promise<void>;
  enhanceProductImageAction: (productId: string, imageIndex?: number, options?: ImageEnhancementOptions) => Promise<EnhancedImageResult | null>;
  batchEnhanceAllImagesAction: (productId: string, options?: ImageEnhancementOptions) => Promise<void>;
  addToCart: (product: Product, quantity?: number, selectedVariant?: string) => void;
  removeFromCart: (productId: string, selectedVariant?: string) => void;
  updateCartQuantity: (productId: string, quantity: number, selectedVariant?: string) => void;
  clearCart: () => void;
  toggleWishlist: (productId: string) => void;
  placeOrder: (customerData: any, paymentId?: string) => Promise<Order | null>;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  toast: { message: string; type: 'success' | 'info' | 'error' } | null;
  setToast: (toast: { message: string; type: 'success' | 'info' | 'error' } | null) => void;
  toastMessage: { text: string; type: 'success' | 'info' | 'error' } | null;
  showToast: (text: string, type?: 'success' | 'info' | 'error') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [viewMode, setViewModeState] = useState<'store' | 'admin'>('store');
  const [userRole, setUserRole] = useState<'admin' | 'customer'>('admin');
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  const setViewMode = (mode: 'store' | 'admin') => {
    if (mode === 'admin' && userRole !== 'admin') {
      showToast('Acceso Restringido: El panel administrativo estÃ¡ reservado para cuentas con rol de Administrador.', 'error');
      setIsAuthModalOpen(true);
      return;
    }
    setViewModeState(mode);
  };

  const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true' || import.meta.env.MODE === 'development';

  const [products, setProducts] = useState<Product[]>(isDemoMode ? INITIAL_PRODUCTS : []);
  const [runs, setRuns] = useState<AutopilotRun[]>(isDemoMode ? INITIAL_RUNS : []);
  const [settings, setSettings] = useState<AutopilotSettings>(DEFAULT_SETTINGS);
  const [suppliers, setSuppliers] = useState<Supplier[]>(isDemoMode ? INITIAL_SUPPLIERS : []);
  const [orders, setOrders] = useState<Order[]>([]);
  const [supplierOrders, setSupplierOrders] = useState<SupplierOrder[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [connectors, setConnectors] = useState<SourceConnectorConfig[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);

  const unreadAlertsCount = alerts.filter(a => !a.resolved && !a.dismissed).length;

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCandidateForReview, setSelectedCandidateForReview] = useState<Product | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAutopilotRunning, setIsAutopilotRunning] = useState(false);
  const [autopilotLiveLogs, setAutopilotLiveLogs] = useState<AutopilotLog[]>([]);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message: text, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const toastMessage = toast ? { text: toast.message, type: toast.type } : null;
  const activeLogs = autopilotLiveLogs.map(l => l.message);

  const signInWithGoogle = async (): Promise<void> => {
    try {
      setIsAuthLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
      if (error) throw error;
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      showToast(`Error al iniciar sesiÃ³n con Google: ${err.message}`, 'error');
      throw err;
    } finally {
      setIsAuthLoading(false);
    }
  };

  const signInWithEmail = async (email: string, pass: string): Promise<void> => {
    try {
      setIsAuthLoading(true);
      const cleanEmail = email.trim();
      const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password: pass });
      if (error) throw error;
      if (data.user) {
        setUser(data.user);
        const { data: profileRow } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
        let role: 'admin' | 'customer' = 'customer';
        let displayName = data.user.user_metadata?.full_name || data.user.email || 'Usuario';
        if (profileRow) {
          role = profileRow.role as any;
          displayName = profileRow.full_name || displayName;
        }
        const profile: UserProfile = { uid: data.user.id, email: data.user.email || '', displayName, role };
        setUserProfile(profile);
        setUserRole(profile.role);
        showToast(`SesiÃ³n iniciada como ${profile.displayName} (${profile.role === 'admin' ? 'Administrador' : 'Cliente'})`, 'success');
      }
    } catch (err: any) {
      console.error('Email sign-in error:', err);
      showToast(err.message || 'Error al iniciar sesiÃ³n.', 'error');
      throw new Error(err.message || 'Error al iniciar sesiÃ³n.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name?: string, _roleChoice?: 'admin' | 'customer'): Promise<void> => {
    try {
      setIsAuthLoading(true);
      const cleanEmail = email.trim();
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: pass,
        options: { data: { full_name: name?.trim() || '' } }
      });
      if (error) throw error;
      if (data.user) {
        if (name && name.trim()) {
          await supabase.auth.updateUser({ data: { full_name: name.trim() } });
        }
        await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: name?.trim() || 'Cliente Victoriosa',
          role: 'customer'
        });
        setUser(data.user);
        const profile: UserProfile = { uid: data.user.id, email: data.user.email || '', displayName: name?.trim() || 'Cliente Victoriosa', role: 'customer' };
        setUserProfile(profile);
        setUserRole('customer');
        showToast(`Cuenta creada con Ã©xito (Rol: Cliente)`, 'success');
      }
    } catch (err: any) {
      console.error('Email sign-up error:', err);
      showToast(err.message || 'Error al crear la cuenta.', 'error');
      throw new Error(err.message || 'Error al crear la cuenta.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const signOutUser = async (): Promise<void> => {
    try {
      setIsAuthLoading(true);
      await supabase.auth.signOut();
      setUser(null);
      setUserProfile(null);
      setUserRole('customer');
      setViewModeState('store');
      showToast('Has cerrado sesiÃ³n.', 'info');
      try {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (!error && data.user) {
          setUser(data.user);
          await supabase.from('profiles').upsert({ id: data.user.id, full_name: 'Cliente Victoriosa', role: 'customer' });
          const guestProfile: UserProfile = { uid: data.user.id, email: data.user.email || 'anonimo@victoriosa.com', displayName: 'Cliente Victoriosa', role: 'customer' };
          setUserProfile(guestProfile);
          setUserRole('customer');
        }
      } catch (e) {
        console.warn('Anonymous guest sign in fallback:', e);
      }
    } catch (err: any) {
      console.error('Sign out error:', err);
      showToast(`Error al cerrar sesiÃ³n: ${err.message}`, 'error');
    } finally {
      setIsAuthLoading(false);
    }
  };

  useEffect(() => {
    const fetchConnectors = async () => {
      try {
        const res = await apiFetch('/api/connectors');
        if (res.ok) {
          const data = await res.json();
          if (data.connectors) setConnectors(data.connectors);
        }
      } catch (err) {
        console.warn('Could not fetch connector list:', err);
      }
    };
    fetchConnectors();
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setIsAuthLoading(true);
      const currentUser = session?.user || null;
      if (currentUser) {
        setUser(currentUser);
        try {
          const { data: profileRow } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single() as { data: any };
          let role: 'admin' | 'customer' = 'customer';
          let displayName = currentUser.user_metadata?.full_name || currentUser.email || 'Usuario';
          if (profileRow) {
            role = profileRow.role as any;
            displayName = profileRow.full_name || displayName;
          }
          const profile: UserProfile = { uid: currentUser.id, email: currentUser.email || '', displayName, role };
          setUserProfile(profile);
          setUserRole(profile.role);
        } catch (e) {
          console.warn('Sync user profile error:', e);
        }
      } else {
        try {
          const { data, error } = await supabase.auth.signInAnonymously();
          if (!error && data.user) {
            setUser(data.user);
            await supabase.from('profiles').upsert({ id: data.user.id, full_name: 'Cliente Victoriosa', role: 'customer' });
            const profile: UserProfile = { uid: data.user.id, email: data.user.email || 'anonimo@victoriosa.com', displayName: 'Cliente Victoriosa', role: 'customer' };
            setUserProfile(profile);
            setUserRole('customer');
          }
        } catch (e) {
          console.warn('Anonymous auth fallback:', e);
        }
      }
      setIsAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const channels: any[] = [];

    const setupSupabase = async () => {
      try {
        const { data: settingsRow } = await supabase.from('settings').select('*').eq('key', 'autopilot_config').single();
        if (settingsRow?.value) {
          setSettings(settingsRow.value as AutopilotSettings);
        } else {
          await supabase.from('settings').upsert(settingsToDbRow(DEFAULT_SETTINGS));
          setSettings(DEFAULT_SETTINGS);
        }

        channels.push(
          supabase.channel('settings-db')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, (payload) => {
              if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                const row = payload.new as any;
                if (row.key === 'autopilot_config' && row.value) {
                  setSettings(row.value as AutopilotSettings);
                }
              }
            })
            .subscribe()
        );

        const { data: productsRows } = await supabase.from('products').select('*');
        if (!productsRows || productsRows.length === 0) {
          if (userRole === 'admin' && isDemoMode) {
            console.log('Seeding initial products to Supabase (demo mode)...');
            try {
              const productRows = INITIAL_PRODUCTS.map(productToSupabaseRow);
              const runRows = INITIAL_RUNS.map((r: any) => ({
                id: r.id,
                run_number: 0,
                status: r.status,
                trigger_type: r.trigger,
                items_found: r.itemsFound,
                items_processed: r.itemsProcessed,
                items_approved: r.itemsApproved,
                items_published: r.itemsPublished,
                items_rejected: r.itemsRejected,
                duration_seconds: r.durationSeconds,
                created_at: r.startedAt,
                updated_at: r.completedAt || r.startedAt
              }));
              await supabase.from('products').upsert(productRows);
              await supabase.from('autopilot_runs').upsert(runRows);
            } catch (seedErr) {
              console.warn('Batch seed error, using memory fallback:', seedErr);
            }
          }
        } else {
          const list: Product[] = productsRows.map((row: any) => supabaseRowToProduct(row));
          list.sort((a, b) => new Date(b.traceability?.updatedAt || 0).getTime() - new Date(a.traceability?.updatedAt || 0).getTime());
          setProducts(list);
        }
        setIsLoading(false);

        channels.push(
          supabase.channel('products-db')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
              if (payload.eventType === 'INSERT') {
                const newProduct = supabaseRowToProduct(payload.new);
                setProducts(prev => {
                  const exists = prev.some(p => p.id === newProduct.id);
                  if (exists) return prev.map(p => p.id === newProduct.id ? newProduct : p);
                  return [newProduct, ...prev];
                });
              } else if (payload.eventType === 'UPDATE') {
                const updated = supabaseRowToProduct(payload.new);
                setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
              } else if (payload.eventType === 'DELETE') {
                const deletedId = (payload.old as any)?.id;
                if (deletedId) {
                  setProducts(prev => prev.filter(p => p.id !== deletedId));
                }
              }
            })
            .subscribe()
        );

        if (userRole === 'admin') {
          const { data: supRows } = await supabase.from('suppliers').select('*');
          if (supRows && supRows.length > 0) {
            const list: Supplier[] = supRows.map((row: any) => supabaseRowToSupplier(row));
            list.sort((a, b) => b.metrics.reliabilityScore - a.metrics.reliabilityScore);
            setSuppliers(list);
          }

          channels.push(
            supabase.channel('suppliers-db')
              .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, (payload) => {
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                  const updated = supabaseRowToSupplier(payload.new);
                  setSuppliers(prev => {
                    const exists = prev.some(s => s.id === updated.id);
                    if (exists) return prev.map(s => s.id === updated.id ? updated : s);
                    return [updated, ...prev];
                  });
                } else if (payload.eventType === 'DELETE') {
                  const deletedId = (payload.old as any)?.id;
                  if (deletedId) setSuppliers(prev => prev.filter(s => s.id !== deletedId));
                }
              })
              .subscribe()
          );

          const { data: runsRows } = await supabase.from('autopilot_runs').select('*');
          if (runsRows && runsRows.length > 0) {
            const rList: AutopilotRun[] = runsRows.map((row: any) => ({
              id: row.id,
              startedAt: row.created_at,
              completedAt: row.updated_at,
              status: row.status,
              trigger: row.trigger_type,
              itemsFound: row.items_found,
              itemsProcessed: row.items_processed,
              itemsApproved: row.items_approved,
              itemsPublished: row.items_published,
              itemsRejected: row.items_rejected,
              durationSeconds: row.duration_seconds || 0,
              logs: []
            }));
            rList.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
            if (rList.length > 0) setRuns(rList);
          }

          channels.push(
            supabase.channel('runs-db')
              .on('postgres_changes', { event: '*', schema: 'public', table: 'autopilot_runs' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                  const row = payload.new as any;
                  const newRun: AutopilotRun = {
                    id: row.id,
                    startedAt: row.created_at,
                    completedAt: row.updated_at,
                    status: row.status,
                    trigger: row.trigger_type,
                    itemsFound: row.items_found,
                    itemsProcessed: row.items_processed,
                    itemsApproved: row.items_approved,
                    itemsPublished: row.items_published,
                    itemsRejected: row.items_rejected,
                    durationSeconds: row.duration_seconds || 0,
                    logs: []
                  };
                  setRuns(prev => [newRun, ...prev]);
                } else if (payload.eventType === 'UPDATE') {
                  const row = payload.new as any;
                  const updatedRun: AutopilotRun = {
                    id: row.id,
                    startedAt: row.created_at,
                    completedAt: row.updated_at,
                    status: row.status,
                    trigger: row.trigger_type,
                    itemsFound: row.items_found,
                    itemsProcessed: row.items_processed,
                    itemsApproved: row.items_approved,
                    itemsPublished: row.items_published,
                    itemsRejected: row.items_rejected,
                    durationSeconds: row.duration_seconds || 0,
                    logs: []
                  };
                  setRuns(prev => prev.map(r => r.id === updatedRun.id ? updatedRun : r));
                }
              })
              .subscribe()
          );

          const { data: ordersRows } = await supabase.from('orders').select('*');
          if (ordersRows) {
            const oList: Order[] = ordersRows.map((row: any) => supabaseRowToOrder(row));
            oList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setOrders(oList);
          }

          channels.push(
            supabase.channel('orders-db')
              .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                  const newOrder = supabaseRowToOrder(payload.new);
                  setOrders(prev => [newOrder, ...prev]);
                } else if (payload.eventType === 'UPDATE') {
                  const updatedOrder = supabaseRowToOrder(payload.new);
                  setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
                } else if (payload.eventType === 'DELETE') {
                  const deletedId = (payload.old as any)?.id;
                  if (deletedId) setOrders(prev => prev.filter(o => o.id !== deletedId));
                }
              })
              .subscribe()
          );

          const { data: supOrdersRows } = await supabase.from('supplier_orders').select('*');
          if (supOrdersRows) {
            const list: SupplierOrder[] = supOrdersRows.map((row: any) => supabaseRowToSupplierOrder(row));
            list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setSupplierOrders(list);
          }

          channels.push(
            supabase.channel('supplier-orders-db')
              .on('postgres_changes', { event: '*', schema: 'public', table: 'supplier_orders' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                  const newSO = supabaseRowToSupplierOrder(payload.new);
                  setSupplierOrders(prev => [newSO, ...prev]);
                } else if (payload.eventType === 'UPDATE') {
                  const updatedSO = supabaseRowToSupplierOrder(payload.new);
                  setSupplierOrders(prev => prev.map(o => o.id === updatedSO.id ? updatedSO : o));
                } else if (payload.eventType === 'DELETE') {
                  const deletedId = (payload.old as any)?.id;
                  if (deletedId) setSupplierOrders(prev => prev.filter(o => o.id !== deletedId));
                }
              })
              .subscribe()
          );

          const { data: alertsRows } = await supabase.from('alerts').select('*');
          if (alertsRows) {
            const list: SystemAlert[] = alertsRows.map((row: any) => supabaseRowToAlert(row));
            list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setAlerts(list);
          }

          channels.push(
            supabase.channel('alerts-db')
              .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                  const newAlert = supabaseRowToAlert(payload.new);
                  setAlerts(prev => [newAlert, ...prev]);
                } else if (payload.eventType === 'UPDATE') {
                  const updatedAlert = supabaseRowToAlert(payload.new);
                  setAlerts(prev => prev.map(a => a.id === updatedAlert.id ? updatedAlert : a));
                } else if (payload.eventType === 'DELETE') {
                  const deletedId = (payload.old as any)?.id;
                  if (deletedId) setAlerts(prev => prev.filter(a => a.id !== deletedId));
                }
              })
              .subscribe()
          );
        } else {
          if (user?.id) {
            const { data: userOrdersRows } = await supabase.from('orders').select('*').eq('user_id', user.id);
            if (userOrdersRows) {
              const oList: Order[] = userOrdersRows.map((row: any) => supabaseRowToOrder(row));
              oList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              setOrders(oList);
            }

            channels.push(
              supabase.channel('customer-orders-db')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` }, (payload) => {
                  if (payload.eventType === 'INSERT') {
                    const newOrder = supabaseRowToOrder(payload.new);
                    setOrders(prev => [newOrder, ...prev]);
                  } else if (payload.eventType === 'UPDATE') {
                    const updatedOrder = supabaseRowToOrder(payload.new);
                    setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
                  } else if (payload.eventType === 'DELETE') {
                    const deletedId = (payload.old as any)?.id;
                    if (deletedId) setOrders(prev => prev.filter(o => o.id !== deletedId));
                  }
                })
                .subscribe()
            );
          }
        }

      } catch (err) {
        console.warn('Supabase sync failed, using offline state:', err);
        setIsLoading(false);
      }
    };

    setupSupabase();

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [userRole, user?.id]);

  const publishedProducts = products.filter((p) => p.status === 'published');
  const candidateProducts = products.filter((p) => p.status !== 'published');

  const runPipelineOnCandidate = async (candidate: Product): Promise<Product | null> => {
    try {
      showToast(`Autopilot analizando "${candidate.title.slice(0, 30)}..."`, 'info');
      const updatedCandidate: Product = {
        ...candidate,
        status: 'analyzing',
        traceability: {
          ...candidate.traceability,
          updatedAt: new Date().toISOString(),
          history: [
            ...(candidate.traceability?.history || []),
            {
              timestamp: new Date().toISOString(),
              stage: 'analysis',
              fromStatus: candidate.status,
              toStatus: 'analyzing',
              action: 'Inicio de anÃ¡lisis multi-etapa por Autopilot',
              actor: 'Autopilot Coordinator'
            }
          ]
        }
      };

      try {
        await supabase.from('products').upsert(productToSupabaseRow(updatedCandidate));
      } catch (e) {
        console.warn('Direct supabase update failed:', e);
      }

      const res = await apiFetch('/api/autopilot/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate, settings })
      });

      if (!res.ok) {
        throw new Error(`Pipeline API returned status ${res.status}`);
      }

      const data = await res.json();
      if (data.success && data.product) {
        const transformed: Product = data.product;
        try {
          await supabase.from('products').upsert(productToSupabaseRow(transformed));
          await supabase.from('audit_logs').insert({
            event_type: 'AUTOPILOT_ANALYZE_COMPLETE',
            entity_id: transformed.id,
            new_values: {
              score: transformed.traceability?.analysis?.overallScore,
              status: transformed.status,
              price: transformed.price
            }
          });
        } catch (dbErr) {
          console.warn('Supabase set failed, updating local state:', dbErr);
          setProducts((prev) => prev.map((p) => (p.id === transformed.id ? transformed : p)));
        }

        if (transformed.status === 'published') {
          showToast(`Â¡"${transformed.title.slice(0, 30)}..." aprobado y publicado en Victoriosa!`, 'success');
        } else if (transformed.status === 'ready_for_review') {
          showToast(`AnÃ¡lisis completado. Listo para revisiÃ³n manual en el panel.`, 'info');
        } else if (transformed.status === 'rejected') {
          showToast(`Candidato descartado por no cumplir criterios de calidad/riesgo.`, 'error');
        }

        return transformed;
      }
      return null;
    } catch (err: any) {
      console.error('Error running pipeline:', err);
      showToast(`Error al procesar el producto: ${err.message}`, 'error');
      return null;
    }
  };

  const discoverNewCandidates = async (category?: string, source?: string, keyword?: string) => {
    try {
      setIsAutopilotRunning(true);
      showToast('Autopilot explorando fuentes globales de catÃ¡logo...', 'info');

      const res = await apiFetch('/api/autopilot/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, source, keyword, count: 3 })
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.candidates)) {
        let addedCount = 0;
        for (const raw of data.candidates) {
          const newId = `vic-cand-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          const candidateProduct: Product = {
            id: newId,
            status: 'discovered',
            title: raw.originalTitle || 'Producto Descubierto',
            originalTitle: raw.originalTitle || 'Producto Descubierto',
            subtitle: 'Oportunidad detectada por Autopilot Discovery Stream',
            slug: `descubierto-${newId}`,
            category: raw.rawCategory || category || 'TecnologÃ­a & Gadgets',
            tags: ['Descubrimiento', raw.sourcePlatform || 'Marketplace'],
            brand: 'Victoriosa',
            description: raw.productConcept || 'Candidato detectado en fuentes de comercio global.',
            originalDescription: raw.productConcept,
            features: raw.rawFeatures || ['CaracterÃ­sticas en proceso de extracciÃ³n y validaciÃ³n'],
            specs: {
              'Fuente': raw.sourcePlatform || 'Global Feed',
              'Proveedor': raw.supplierName || 'Distribuidor Mayorista',
              'PaÃ­s Origen': raw.supplierCountry || 'UE / Global'
            },
            images: raw.rawImages || ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&auto=format&fit=crop&q=80'],
            originalImages: raw.rawImages || [],
            price: raw.costPriceEur ? +(raw.costPriceEur * 2.4).toFixed(2) : 49.95,
            costPrice: raw.costPriceEur || 20,
            inventory: 30,
            sku: raw.sourceSku || `RAW-${Math.floor(Math.random() * 89999 + 10000)}`,
            badges: ['Oportunidad ReciÃ©n Detectada'],
            rating: raw.sourceRating || 4.7,
            reviewCount: 12,
            traceability: {
              createdBy: 'Autopilot Discovery Engine v3.0',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              source: {
                name: raw.supplierName || 'Marketplace Seller',
                url: raw.sourceUrl || 'https://source-feed.internal',
                platform: (raw.sourcePlatform as any) || 'Amazon Global',
                sku: raw.sourceSku || 'SKU-AUTO',
                rating: raw.sourceRating || 4.7,
                rawCategory: raw.rawCategory || 'General'
              },
              supplier: {
                name: raw.supplierName || 'Global Supplier',
                reliabilityScore: raw.supplierReliability || 88,
                country: raw.supplierCountry || 'EspaÃ±a / UE',
                shippingDaysMin: raw.shippingDaysMin || 2,
                shippingDaysMax: raw.shippingDaysMax || 5,
                returnPolicy: '30 dÃ­as'
              },
              pricing: {
                originalCostEur: raw.costPriceEur || 20,
                originalCurrency: 'EUR',
                supplierShippingCost: raw.supplierShippingCost || 3.5,
                estimatedCustoms: 0.8,
                gatewayFee: 1.5,
                targetMarginPct: 55,
                suggestedPrice: +((raw.costPriceEur || 20) * 2.3).toFixed(2),
                retailPrice: +((raw.costPriceEur || 20) * 2.3).toFixed(2),
                potentialProfit: +((raw.costPriceEur || 20) * 1.2).toFixed(2),
                psychologicalEnding: '95'
              },
              analysis: {
                demandScore: 85,
                competitionLevel: 'medium',
                marginPotential: 88,
                brandFitScore: 84,
                brandFitJustification: 'Pendiente de anÃ¡lisis completo por Gemini.',
                qualityScore: 86,
                logisticsScore: 88,
                overallScore: 85,
                scoreTier: 'A',
                targetAudience: 'Compradores Victoriosa',
                keySellingPoints: ['Potencial de margen saludable', 'Buena reputaciÃ³n de origen'],
                validatedClaims: [],
                potentialIssues: []
              },
              risk: {
                level: 'low',
                copyrightRisk: 'none',
                claimsRisk: 'safe',
                supplierRisk: 'safe',
                returnRisk: 'low',
                details: ['Pendiente de moderaciÃ³n automÃ¡tica.']
              },
              history: [
                {
                  timestamp: new Date().toISOString(),
                  stage: 'discovery',
                  fromStatus: 'discovered',
                  toStatus: 'discovered',
                  action: `Descubierto en ${raw.sourcePlatform || 'fuente automatizada'}`,
                  actor: 'Autopilot Discovery Crawler'
                }
              ]
            }
          };

          try {
            await supabase.from('products').upsert(productToSupabaseRow(candidateProduct));
          } catch (e) {
            setProducts((prev) => [candidateProduct, ...prev]);
          }
          addedCount++;
        }
        showToast(`Se descubrieron ${addedCount} nuevos candidatos potenciales.`, 'success');
      }
    } catch (e: any) {
      console.error('Discovery error:', e);
      showToast(`Error en Discovery: ${e.message}`, 'error');
    } finally {
      setIsAutopilotRunning(false);
    }
  };

  const triggerFullAutopilotRun = async (category?: string, source?: string) => {
    setIsAutopilotRunning(true);
    const runId = `run-${Date.now()}`;
    const startTime = new Date().toISOString();

    const logs: AutopilotLog[] = [
      { timestamp: new Date().toISOString(), level: 'info', message: `Iniciando ejecuciÃ³n completa de Autopilot (${runId}).` },
      { timestamp: new Date().toISOString(), level: 'info', message: `Filtros: CategorÃ­a "${category || 'Todas'}", Fuente "${source || 'Multi-Fuente'}".` }
    ];
    setAutopilotLiveLogs([...logs]);

    try {
      logs.push({ timestamp: new Date().toISOString(), level: 'info', message: 'Fase 1/3: Descubriendo nuevos candidatos...' });
      setAutopilotLiveLogs([...logs]);

      const discRes = await apiFetch('/api/autopilot/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, source, count: 2 })
      });
      const discData = await discRes.json();
      const rawCandidates = discData.candidates || [];

      logs.push({ timestamp: new Date().toISOString(), level: 'success', message: `Fase 1 completada: ${rawCandidates.length} oportunidades identificadas.` });
      setAutopilotLiveLogs([...logs]);

      let approvedCount = 0;
      let publishedCount = 0;
      let rejectedCount = 0;

      for (let i = 0; i < rawCandidates.length; i++) {
        const item = rawCandidates[i];
        logs.push({ timestamp: new Date().toISOString(), level: 'info', message: `Fase 2/3: Analizando candidato [${i + 1}/${rawCandidates.length}] "${item.originalTitle.slice(0, 30)}..."` });
        setAutopilotLiveLogs([...logs]);

        const analyzeRes = await apiFetch('/api/autopilot/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidate: item, settings })
        });
        const analyzeData = await analyzeRes.json();

        if (analyzeData.success && analyzeData.product) {
          const prod: Product = analyzeData.product;
          try {
            await supabase.from('products').upsert(productToSupabaseRow(prod));
          } catch (e) {
            setProducts((prev) => [prod, ...prev]);
          }

          if (prod.status === 'published') {
            publishedCount++;
            approvedCount++;
            logs.push({ timestamp: new Date().toISOString(), level: 'success', message: `âœ“ Aprobado y Publicado: "${prod.title.slice(0, 25)}..." (Score: ${prod.traceability.analysis.overallScore})` });
          } else if (prod.status === 'approved') {
            approvedCount++;
            logs.push({ timestamp: new Date().toISOString(), level: 'success', message: `âœ“ Aprobado para Draft: "${prod.title.slice(0, 25)}..."` });
          } else if (prod.status === 'rejected') {
            rejectedCount++;
            logs.push({ timestamp: new Date().toISOString(), level: 'warn', message: `âœ— Rechazado: Riesgo o margen no apto.` });
          } else {
            logs.push({ timestamp: new Date().toISOString(), level: 'info', message: `â†’ En espera de revisiÃ³n manual (Score: ${prod.traceability?.analysis?.overallScore || 'N/A'})` });
          }
          setAutopilotLiveLogs([...logs]);
        }
      }

      const completedAt = new Date().toISOString();
      const newRun: AutopilotRun = {
        id: runId,
        startedAt: startTime,
        completedAt,
        status: 'completed',
        trigger: 'manual',
        itemsFound: rawCandidates.length,
        itemsProcessed: rawCandidates.length,
        itemsApproved: approvedCount,
        itemsPublished: publishedCount,
        itemsRejected: rejectedCount,
        durationSeconds: Math.round((new Date(completedAt).getTime() - new Date(startTime).getTime()) / 1000),
        logs
      };

      try {
        await supabase.from('autopilot_runs').upsert({
          id: runId,
          status: 'completed',
          trigger_type: 'manual',
          items_found: rawCandidates.length,
          items_processed: rawCandidates.length,
          items_approved: approvedCount,
          items_published: publishedCount,
          items_rejected: rejectedCount,
          duration_seconds: newRun.durationSeconds,
          created_at: startTime,
          updated_at: completedAt
        });
      } catch (e) {
        setRuns((prev) => [newRun, ...prev]);
      }

      logs.push({ timestamp: new Date().toISOString(), level: 'success', message: `EjecuciÃ³n finalizada con Ã©xito. ${publishedCount} productos nuevos en Victoriosa.` });
      setAutopilotLiveLogs([...logs]);
      showToast(`EjecuciÃ³n de Autopilot finalizada: ${publishedCount} publicados, ${approvedCount} aprobados.`, 'success');

    } catch (err: any) {
      console.error('Autopilot run error:', err);
      logs.push({ timestamp: new Date().toISOString(), level: 'error', message: `Error en la ejecuciÃ³n: ${err.message}` });
      setAutopilotLiveLogs([...logs]);
      showToast(`Fallo en ejecuciÃ³n del Autopilot: ${err.message}`, 'error');
    } finally {
      setIsAutopilotRunning(false);
    }
  };

  const approveProduct = async (productId: string, autoPublish: boolean = true) => {
    const target = products.find((p) => p.id === productId);
    if (!target) return;

    const newStatus: ProductStatus = autoPublish ? 'published' : 'approved';
    const updated: Product = {
      ...target,
      status: newStatus,
      traceability: {
        ...target.traceability,
        updatedAt: new Date().toISOString(),
        history: [
          ...(target.traceability?.history || []),
          {
            timestamp: new Date().toISOString(),
            stage: autoPublish ? 'publication' : 'draft',
            fromStatus: target.status,
            toStatus: newStatus,
            action: autoPublish ? 'Aprobado y publicado en tienda pÃºblica' : 'Aprobado por el Administrador',
            actor: 'Administrador (Panel Victoriosa)'
          }
        ]
      }
    };

    try {
      await supabase.from('products').upsert(productToSupabaseRow(updated));
      await supabase.from('audit_logs').insert({
        event_type: autoPublish ? 'PRODUCT_PUBLISHED_MANUAL' : 'PRODUCT_APPROVED_MANUAL',
        entity_id: productId,
        new_values: { previousStatus: target.status, newStatus }
      });
    } catch (e) {
      setProducts((prev) => prev.map((p) => (p.id === productId ? updated : p)));
    }

    showToast(autoPublish ? `"${target.title.slice(0, 30)}..." ya estÃ¡ visible en la tienda pÃºblica.` : `Producto aprobado exitosamente.`, 'success');
  };

  const publishProduct = async (productId: string) => {
    await approveProduct(productId, true);
  };

  const unpublishProduct = async (productId: string) => {
    const target = products.find((p) => p.id === productId);
    if (!target) return;

    const updated: Product = {
      ...target,
      status: 'draft_ready',
      traceability: {
        ...target.traceability,
        updatedAt: new Date().toISOString(),
        history: [
          ...(target.traceability?.history || []),
          {
            timestamp: new Date().toISOString(),
            stage: 'review',
            fromStatus: target.status,
            toStatus: 'draft_ready',
            action: 'Despublicado del catÃ¡logo pÃºblico (movido a borrador)',
            actor: 'Administrador (Panel Victoriosa)'
          }
        ]
      }
    };

    try {
      await supabase.from('products').upsert(productToSupabaseRow(updated));
      await supabase.from('audit_logs').insert({
        event_type: 'PRODUCT_UNPUBLISHED',
        entity_id: productId,
        new_values: { previousStatus: target.status }
      });
    } catch (e) {
      setProducts((prev) => prev.map((p) => (p.id === productId ? updated : p)));
    }

    showToast(`El producto ha sido despublicado y retirado de la tienda pÃºblica.`, 'info');
  };

  const rejectProduct = async (productId: string, reason: string) => {
    const target = products.find((p) => p.id === productId);
    if (!target) return;

    const updated: Product = {
      ...target,
      status: 'rejected',
      rejectionReason: reason,
      traceability: {
        ...target.traceability,
        updatedAt: new Date().toISOString(),
        history: [
          ...(target.traceability?.history || []),
          {
            timestamp: new Date().toISOString(),
            stage: 'risk',
            fromStatus: target.status,
            toStatus: 'rejected',
            action: `Rechazado: ${reason}`,
            actor: 'Administrador (ModeraciÃ³n Manual)'
          }
        ]
      }
    };

    try {
      await supabase.from('products').upsert(productToSupabaseRow(updated));
      await supabase.from('audit_logs').insert({
        event_type: 'PRODUCT_REJECTED',
        entity_id: productId,
        new_values: { reason }
      });
    } catch (e) {
      setProducts((prev) => prev.map((p) => (p.id === productId ? updated : p)));
    }

    showToast(`Producto marcado como rechazado. No se publicarÃ¡.`, 'error');
  };

  const saveProductEdits = async (product: Product) => {
    const updated: Product = {
      ...product,
      traceability: {
        ...product.traceability,
        updatedAt: new Date().toISOString(),
        history: [
          ...(product.traceability?.history || []),
          {
            timestamp: new Date().toISOString(),
            stage: 'draft',
            action: 'EdiciÃ³n manual de campos (tÃ­tulo, precio o especificaciones)',
            actor: 'Administrador'
          }
        ]
      }
    };

    try {
      await supabase.from('products').upsert(productToSupabaseRow(updated));
      await supabase.from('audit_logs').insert({
        event_type: 'PRODUCT_MANUAL_EDIT',
        entity_id: product.id,
        new_values: { title: product.title, price: product.price }
      });
    } catch (e) {
      setProducts((prev) => prev.map((p) => (p.id === product.id ? updated : p)));
    }

    showToast('Cambios guardados correctamente.', 'success');
  };

  const deleteProduct = async (productId: string) => {
    try {
      await supabase.from('products').delete().eq('id', productId);
      await supabase.from('audit_logs').insert({
        event_type: 'PRODUCT_DELETED',
        entity_id: productId,
        new_values: {}
      });
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      showToast('Producto eliminado del sistema.', 'info');
    } catch (e) {
      setProducts((prev) => prev.filter((p) => p.id !== productId));
    }
  };

  const updateSettings = async (newSettings: Partial<AutopilotSettings>) => {
    const merged = { ...settings, ...newSettings };
    setSettings(merged);
    try {
      await supabase.from('settings').upsert(settingsToDbRow(merged));
      showToast('ConfiguraciÃ³n del Autopilot actualizada.', 'success');
    } catch (e) {
      console.warn('Failed to save settings to Supabase:', e);
    }
  };

  const resetToInitialData = async () => {
    if (!isDemoMode) {
      showToast('Reset no disponible en modo producciÃ³n.', 'error');
      return;
    }
    try {
      const productRows = INITIAL_PRODUCTS.map(productToSupabaseRow);
      const runRows = INITIAL_RUNS.map((r: any) => ({
        id: r.id,
        run_number: 0,
        status: r.status,
        trigger_type: r.trigger,
        items_found: r.itemsFound,
        items_processed: r.itemsProcessed,
        items_approved: r.itemsApproved,
        items_published: r.itemsPublished,
        items_rejected: r.itemsRejected,
        duration_seconds: r.durationSeconds,
        created_at: r.startedAt,
        updated_at: r.completedAt || r.startedAt
      }));
      await supabase.from('products').upsert(productRows);
      await supabase.from('autopilot_runs').upsert(runRows);
      setProducts(INITIAL_PRODUCTS);
      setRuns(INITIAL_RUNS);
      showToast('Base de datos restablecida con datos iniciales verificados.', 'success');
    } catch (e) {
      setProducts(INITIAL_PRODUCTS);
      setRuns(INITIAL_RUNS);
    }
  };

  const addToCart = (product: Product, quantity = 1, selectedVariant?: string) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.product.id === product.id && item.selectedVariant === selectedVariant
      );
      if (existingIndex > -1) {
        const next = [...prev];
        next[existingIndex].quantity += quantity;
        return next;
      }
      return [...prev, { product, quantity, selectedVariant }];
    });
    setIsCartOpen(true);
    showToast(`"${product.title.slice(0, 25)}..." aÃ±adido a tu bolsa`, 'success');
  };

  const removeFromCart = (productId: string, selectedVariant?: string) => {
    setCart((prev) =>
      prev.filter((item) => !(item.product.id === productId && item.selectedVariant === selectedVariant))
    );
  };

  const updateCartQuantity = (productId: string, quantity: number, selectedVariant?: string) => {
    if (quantity <= 0) {
      removeFromCart(productId, selectedVariant);
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId && item.selectedVariant === selectedVariant) {
          return { ...item, quantity };
        }
        return item;
      })
    );
  };

  const clearCart = () => setCart([]);

  const toggleWishlist = (productId: string) => {
    setWishlist((prev) => {
      const exists = prev.includes(productId);
      const next = exists ? prev.filter((id) => id !== productId) : [...prev, productId];
      showToast(exists ? 'Eliminado de tus favoritos' : 'Guardado en tus favoritos', 'info');
      return next;
    });
  };

  const placeOrder = async (_customerData: any, _paymentId?: string): Promise<Order | null> => {
    showToast('Usá el checkout para crear pedidos y verificar pagos en el servidor.', 'error');
    return null;
  };

  const performPrePurchaseVerification = async (productId: string, supplierOrderId?: string): Promise<PrePurchaseVerificationResult | null> => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return null;

    const sourcePlatform = prod.traceability?.source?.platform || 'Supplier Hub B2B';
    const cost = prod.costPrice || 25.00;
    const shipping = prod.traceability?.pricing?.supplierShippingCost || 3.50;

    try {
      showToast(`Verificando stock y margen en tiempo real con ${sourcePlatform}...`, 'info');
      const res = await apiFetch('/api/fulfillment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceUrl: prod.traceability?.source?.url || '',
          sourceSku: prod.traceability?.source?.sku || prod.sku,
          sourcePlatform,
          expectedCost: cost,
          expectedShipping: shipping,
          salePrice: prod.price
        })
      });

      const data = await res.json();
      if (data.success && data.verification) {
        const verification: PrePurchaseVerificationResult = data.verification;

        if (supplierOrderId) {
          await supabase.from('supplier_orders').update({
            verification: verification,
            updated_at: new Date().toISOString()
          }).eq('id', supplierOrderId);
        }

        showToast(
          verification.passed ? 'âœ“ VerificaciÃ³n previa superada: Stock confirmado' : 'âš  VerificaciÃ³n alertÃ³ margen o stock',
          verification.passed ? 'success' : 'warn' as any
        );

        return verification;
      }
      return null;
    } catch (err: any) {
      console.error('Pre-purchase verification error:', err);
      showToast(`Error al verificar proveedor: ${err.message}`, 'error');
      return null;
    }
  };

  const executeSupplierPurchase = async (supplierOrderId: string): Promise<void> => {
    const sOrder = supplierOrders.find(o => o.id === supplierOrderId);
    if (!sOrder) return;

    try {
      showToast(`Conectando con proveedor para tramitar pedido #${supplierOrderId.slice(-6)}...`, 'info');
      const res = await apiFetch('/api/fulfillment/create-supplier-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierOrder: sOrder })
      });

      const data = await res.json();
      const now = new Date().toISOString();

      if (data.status === 'order_placed') {
        const updatedFields = {
          status: 'order_placed',
          supplier_order_reference: data.supplierOrderReference,
          tracking_number: data.trackingNumber,
          carrier: data.carrier,
          updated_at: now
        };
        await supabase.from('supplier_orders').update(updatedFields).eq('id', supplierOrderId);
        await supabase.from('audit_logs').insert({
          event_type: 'SUPPLIER_ORDER_PLACED',
          entity_id: supplierOrderId,
          new_values: { reference: data.supplierOrderReference }
        });
        showToast(`âœ“ Pedido a proveedor completado con Ã©xito (Ref: ${data.supplierOrderReference})`, 'success');
      } else {
        const updatedFields = {
          status: 'human_action_required',
          human_action_reason: data.humanActionReason || 'Requiere compra manual en el marketplace.',
          updated_at: now
        };
        await supabase.from('supplier_orders').update(updatedFields).eq('id', supplierOrderId);
        showToast('AcciÃ³n requerida: La orden requiere compra manual por operador.', 'info');
      }
    } catch (err: any) {
      console.error('Execute supplier purchase error:', err);
      showToast(`Error al tramitar con proveedor: ${err.message}`, 'error');
    }
  };

  const markSupplierOrderAsManualBought = async (
    supplierOrderId: string,
    notes?: string,
    trackingNumber?: string,
    carrier: string = 'Correos Express / DHL'
  ): Promise<void> => {
    const sOrder = supplierOrders.find(o => o.id === supplierOrderId);
    if (!sOrder) return;

    const now = new Date().toISOString();
    const updatedStatus = trackingNumber ? 'shipped' : 'order_placed';

    try {
      await supabase.from('supplier_orders').update({
        status: updatedStatus,
        supplier_order_reference: notes || `MANUAL-BUY-${Date.now().toString().slice(-5)}`,
        tracking_number: trackingNumber || sOrder.trackingNumber,
        carrier: carrier || sOrder.carrier,
        updated_at: now
      }).eq('id', supplierOrderId);
      await supabase.from('audit_logs').insert({
        event_type: 'SUPPLIER_ORDER_MANUAL_BOUGHT',
        entity_id: supplierOrderId,
        new_values: { notes, trackingNumber }
      });

      const relAlert = alerts.find(a => a.supplierOrderId === supplierOrderId && !a.resolved);
      if (relAlert) {
        await supabase.from('alerts').update({ resolved: true, resolved_at: now }).eq('id', relAlert.id);
      }

      showToast(`Orden #${supplierOrderId.slice(-6)} marcada como comprada exitosamente.`, 'success');
    } catch (err: any) {
      console.warn('Supabase update supplier order error:', err);
    }
  };

  const updateSupplierOrderTracking = async (supplierOrderId: string, trackingNumber: string, carrier: string): Promise<void> => {
    const sOrder = supplierOrders.find(o => o.id === supplierOrderId);
    if (!sOrder) return;

    const now = new Date().toISOString();

    try {
      await supabase.from('supplier_orders').update({
        status: 'shipped',
        tracking_number: trackingNumber,
        carrier,
        updated_at: now
      }).eq('id', supplierOrderId);
      await supabase.from('audit_logs').insert({
        event_type: 'SUPPLIER_ORDER_TRACKING_UPDATED',
        entity_id: supplierOrderId,
        new_values: { trackingNumber, carrier }
      });
      showToast(`Seguimiento actualizado para #${supplierOrderId.slice(-6)}: ${trackingNumber}`, 'success');
    } catch (err: any) {
      console.warn('Supabase update tracking error:', err);
    }
  };

  const cancelSupplierOrder = async (supplierOrderId: string, reason: string): Promise<void> => {
    const sOrder = supplierOrders.find(o => o.id === supplierOrderId);
    if (!sOrder) return;

    const now = new Date().toISOString();

    try {
      await supabase.from('supplier_orders').update({
        status: 'cancelled',
        human_action_reason: `Cancelado: ${reason}`,
        updated_at: now
      }).eq('id', supplierOrderId);
      await supabase.from('audit_logs').insert({
        event_type: 'SUPPLIER_ORDER_CANCELLED',
        entity_id: supplierOrderId,
        new_values: { reason }
      });
      showToast(`Orden #${supplierOrderId.slice(-6)} cancelada.`, 'info');
    } catch (err: any) {
      console.warn('Supabase cancel order error:', err);
    }
  };

  const resolveAlert = async (alertId: string): Promise<void> => {
    const alert = alerts.find(a => a.id === alertId);
    if (!alert) return;

    try {
      await supabase.from('alerts').update({ resolved: true, resolved_at: new Date().toISOString() }).eq('id', alertId);
      showToast('Alerta marcada como resuelta.', 'success');
    } catch (err: any) {
      console.warn('Supabase resolve alert error:', err);
    }
  };

  const dismissAlert = async (alertId: string): Promise<void> => {
    const alert = alerts.find(a => a.id === alertId);
    if (!alert) return;

    try {
      await supabase.from('alerts').update({ dismissed: true }).eq('id', alertId);
      showToast('Alerta descartada.', 'info');
    } catch (err: any) {
      console.warn('Supabase dismiss alert error:', err);
    }
  };

  const createSystemAlert = async (alertData: Omit<SystemAlert, 'id' | 'createdAt'>): Promise<void> => {
    const alertId = `alt-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5)}`;

    try {
      await supabase.from('alerts').upsert({
        id: alertId,
        alert_type: alertData.type,
        severity: alertData.severity,
        title: alertData.title,
        message: alertData.message,
        product_id: alertData.productId,
        supplier_order_id: alertData.supplierOrderId,
        source_platform: alertData.sourcePlatform,
        action_link: alertData.actionLink,
        resolved: alertData.resolved || false,
        dismissed: alertData.dismissed || false,
        created_at: new Date().toISOString()
      });
    } catch (err: any) {
      console.warn('Supabase create alert error:', err);
    }
  };

  const importProductFromUrl = async (url: string): Promise<Product | null> => {
    try {
      showToast('Extrayendo metadatos de la URL con Autopilot...', 'info');
      const res = await apiFetch('/api/connectors/direct-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const data = await res.json();
      if (data.success && data.candidate) {
        showToast('Analizando producto con IA y aplicando identidad Victoriosa...', 'info');
        const analyzed = await runPipelineOnCandidate(data.candidate);
        if (analyzed) {
          showToast(`Â¡Producto "${analyzed.title.slice(0, 25)}..." importado con Ã©xito!`, 'success');
          return analyzed;
        }
      }
      showToast('No se pudo procesar la URL indicada.', 'error');
      return null;
    } catch (err: any) {
      console.error('Import product from URL error:', err);
      showToast(`Error al importar URL: ${err.message}`, 'error');
      return null;
    }
  };

  const discoverProducts = async (category?: string, source?: string, count: number = 3, keyword?: string): Promise<void> => {
    await discoverNewCandidates(category, source, keyword);
  };

  const addSupplier = async (supplierData: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): Promise<Supplier> => {
    const newId = `sup-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
    const now = new Date().toISOString();
    const newSupplier: Supplier = {
      ...supplierData,
      id: newId,
      createdAt: now,
      updatedAt: now
    };

    try {
      await supabase.from('suppliers').upsert(supplierToSupabaseRow(newSupplier));
      await supabase.from('audit_logs').insert({
        event_type: 'SUPPLIER_CREATED',
        entity_id: newId,
        new_values: { name: newSupplier.name, code: newSupplier.code }
      });
      setSuppliers(prev => [newSupplier, ...prev]);
      showToast(`Proveedor "${newSupplier.name}" registrado correctamente.`, 'success');
      return newSupplier;
    } catch (err: any) {
      console.warn('Supabase write supplier error, updating local state:', err);
      setSuppliers(prev => [newSupplier, ...prev]);
      showToast(`Proveedor guardado localmente: ${newSupplier.name}`, 'info');
      return newSupplier;
    }
  };

  const updateSupplier = async (supplier: Supplier): Promise<void> => {
    const updated: Supplier = {
      ...supplier,
      updatedAt: new Date().toISOString()
    };

    try {
      await supabase.from('suppliers').upsert(supplierToSupabaseRow(updated));
      await supabase.from('audit_logs').insert({
        event_type: 'SUPPLIER_UPDATED',
        entity_id: supplier.id,
        new_values: { name: supplier.name, reliabilityScore: supplier.metrics.reliabilityScore }
      });
      setSuppliers(prev => prev.map(s => s.id === supplier.id ? updated : s));
      showToast(`Acuerdos y datos de "${supplier.name}" actualizados.`, 'success');
    } catch (err: any) {
      console.warn('Supabase update supplier error:', err);
      setSuppliers(prev => prev.map(s => s.id === supplier.id ? updated : s));
    }
  };

  const deleteSupplier = async (supplierId: string): Promise<void> => {
    try {
      await supabase.from('suppliers').delete().eq('id', supplierId);
      await supabase.from('audit_logs').insert({
        event_type: 'SUPPLIER_DELETED',
        entity_id: supplierId,
        new_values: {}
      });
      setSuppliers(prev => prev.filter(s => s.id !== supplierId));
      showToast('Proveedor eliminado del directorio.', 'info');
    } catch (err: any) {
      setSuppliers(prev => prev.filter(s => s.id !== supplierId));
    }
  };

  const assignSupplierToProduct = async (productId: string, supplierId: string): Promise<void> => {
    const prod = products.find(p => p.id === productId);
    const sup = suppliers.find(s => s.id === supplierId);
    if (!prod || !sup) return;

    const discount = sup.pricingAgreements.baseDiscountPct || 15;
    const effectiveCost = +(prod.costPrice * (1 - discount / 100)).toFixed(2);
    const shipping = sup.pricingAgreements.avgShippingPerUnit || 3.5;

    const updated: Product = {
      ...prod,
      supplierId: sup.id,
      costPrice: effectiveCost,
      traceability: {
        ...prod.traceability,
        updatedAt: new Date().toISOString(),
        supplier: {
          name: sup.name,
          reliabilityScore: sup.metrics.reliabilityScore,
          country: sup.contact.country,
          shippingDaysMin: sup.pricingAgreements.leadTimeDaysMin || 0,
          shippingDaysMax: sup.pricingAgreements.leadTimeDaysMax || 0,
          returnPolicy: sup.pricingAgreements.returnAgreement
        },
        pricing: {
          ...prod.traceability.pricing,
          originalCostEur: effectiveCost,
          supplierShippingCost: shipping,
          potentialProfit: +(prod.price - effectiveCost - shipping - prod.traceability.pricing.gatewayFee).toFixed(2)
        },
        history: [
          ...(prod.traceability?.history || []),
          {
            timestamp: new Date().toISOString(),
            stage: 'supplier_verification',
            action: `Proveedor asignado: ${sup.name} (Descuento B2B: ${discount}%, Fiabilidad: ${sup.metrics.reliabilityScore}%)`,
            actor: 'Administrador'
          }
        ]
      }
    };

    try {
      await supabase.from('products').upsert(productToSupabaseRow(updated));
      await supabase.from('audit_logs').insert({
        event_type: 'PRODUCT_SUPPLIER_ASSIGNED',
        entity_id: productId,
        new_values: { supplierId: sup.id, supplierName: sup.name }
      });
      setProducts(prev => prev.map(p => p.id === productId ? updated : p));
      showToast(`Proveedor "${sup.name}" vinculado a "${prod.title.slice(0, 25)}..."`, 'success');
    } catch (e) {
      setProducts(prev => prev.map(p => p.id === productId ? updated : p));
    }
  };

  const enhanceProductImageAction = async (
    productId: string,
    imageIndex: number = 0,
    options?: ImageEnhancementOptions
  ): Promise<EnhancedImageResult | null> => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return null;

    try {
      showToast(`Procesando optimizaciÃ³n de imagen #${imageIndex + 1}...`, 'info');
      const { enhancedResult, updatedProduct } = await enhanceAndPersistProductImage(prod, imageIndex, options);

      try {
        await supabase.from('products').upsert(productToSupabaseRow(updatedProduct));
        await supabase.from('audit_logs').insert({
          event_type: 'PRODUCT_IMAGE_ENHANCED',
          entity_id: productId,
          new_values: {
            imageIndex,
            appliedFilters: enhancedResult.appliedFilters,
            dimensions: enhancedResult.dimensions
          }
        });
      } catch (dbErr) {
        console.warn('Supabase product image update notice:', dbErr);
      }

      setProducts(prev => prev.map(p => p.id === productId ? updatedProduct : p));
      showToast(`Â¡Imagen #${imageIndex + 1} optimizada y guardada!`, 'success');
      return enhancedResult;
    } catch (err: any) {
      console.error('Error enhancing product image:', err);
      showToast(`Error al retocar imagen: ${err.message}`, 'error');
      return null;
    }
  };

  const batchEnhanceAllImagesAction = async (
    productId: string,
    options?: ImageEnhancementOptions
  ): Promise<void> => {
    const prod = products.find(p => p.id === productId);
    if (!prod || !prod.images.length) return;

    showToast(`Iniciando retocado por lotes de ${prod.images.length} imÃ¡genes...`, 'info');
    let currentProd = prod;
    for (let i = 0; i < currentProd.images.length; i++) {
      const { updatedProduct } = await enhanceAndPersistProductImage(currentProd, i, options);
      currentProd = updatedProduct;
    }

    try {
      await supabase.from('products').upsert(productToSupabaseRow(currentProd));
    } catch (e) {
      console.warn('Supabase batch image set error:', e);
    }

    setProducts(prev => prev.map(p => p.id === productId ? currentProd : p));
    showToast(`Todas las imÃ¡genes (${currentProd.images.length}) han sido optimizadas con Ã©xito.`, 'success');
  };

  const runFullAutopilotBatch = async ({
    category = 'RelojerÃ­a',
    maxCandidates = 2,
    autoPublishApproved = false,
    targetMarginPct = 55
  }: {
    category?: string;
    maxCandidates?: number;
    autoPublishApproved?: boolean;
    targetMarginPct?: number;
  }) => {
    setIsAutopilotRunning(true);
    const runId = `run-${Date.now()}`;
    const startTime = new Date().toISOString();

    const batchLogs: AutopilotLog[] = [
      { timestamp: new Date().toISOString(), level: 'info', message: `Autopilot Batch Run (${runId}) inicializado.` },
      { timestamp: new Date().toISOString(), level: 'info', message: `ParÃ¡metros: CategorÃ­a "${category}", Lote ${maxCandidates} Ã­tems, Margen Min ${targetMarginPct}%.` }
    ];
    setAutopilotLiveLogs([...batchLogs]);

    try {
      batchLogs.push({ timestamp: new Date().toISOString(), level: 'info', message: `Etapa 1/4: Descubriendo ${maxCandidates} candidatos en fuentes globales...` });
      setAutopilotLiveLogs([...batchLogs]);

      const discRes = await apiFetch('/api/autopilot/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, count: maxCandidates })
      });
      const discData = await discRes.json();
      const rawCandidates = discData.candidates?.slice(0, maxCandidates) || [];

      batchLogs.push({ timestamp: new Date().toISOString(), level: 'success', message: `âœ“ Etapa 1 completada: ${rawCandidates.length} oportunidades extraÃ­das.` });
      setAutopilotLiveLogs([...batchLogs]);

      let approvedCount = 0;
      let publishedCount = 0;
      let rejectedCount = 0;

      for (let i = 0; i < rawCandidates.length; i++) {
        const item = rawCandidates[i];
        batchLogs.push({ timestamp: new Date().toISOString(), level: 'info', message: `Etapa 2/4: Evaluando [${i + 1}/${rawCandidates.length}] "${item.originalTitle.slice(0, 28)}..." con Gemini AI...` });
        setAutopilotLiveLogs([...batchLogs]);

        const matchedSupplier = suppliers.find(s =>
          s.catalogs.categories.some(c => c.toLowerCase().includes(category.toLowerCase())) ||
          s.name.toLowerCase().includes((item.supplierName || '').toLowerCase())
        );

        if (matchedSupplier) {
          item.supplierName = matchedSupplier.name;
          item.supplierReliability = matchedSupplier.metrics.reliabilityScore;
          item.supplierCountry = matchedSupplier.contact.country;
          item.supplierShippingCost = matchedSupplier.pricingAgreements.avgShippingPerUnit;
          batchLogs.push({ timestamp: new Date().toISOString(), level: 'success', message: `âœ“ Proveedor verificado en base de datos: ${matchedSupplier.name} (Score: ${matchedSupplier.metrics.reliabilityScore}%)` });
          setAutopilotLiveLogs([...batchLogs]);
        }

        const analyzeRes = await apiFetch('/api/autopilot/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidate: item,
            settings: {
              ...settings,
              minMarginPercentage: targetMarginPct,
              autoPublishApproved
            }
          })
        });

        const analyzeData = await analyzeRes.json();
        if (analyzeData.success && analyzeData.product) {
          let prod: Product = analyzeData.product;

          batchLogs.push({ timestamp: new Date().toISOString(), level: 'info', message: `Etapa 3/4: Pipeline de mejora de imagen para "${prod.title.slice(0, 24)}..."` });
          setAutopilotLiveLogs([...batchLogs]);

          try {
            if (prod.images && prod.images[0]) {
              const { updatedProduct } = await enhanceAndPersistProductImage(prod, 0, {
                aspectRatio: '1:1',
                studioBackdrop: 'dark_studio',
                removeBackground: true,
                studioLighting: true
              });
              prod = updatedProduct;
              batchLogs.push({ timestamp: new Date().toISOString(), level: 'success', message: `âœ“ Imagen de producto optimizada en estudio digital (1000x1000px, Obsidian Dark)` });
              setAutopilotLiveLogs([...batchLogs]);
            }
          } catch (imgErr) {
            console.warn('Image auto-enhancement warning:', imgErr);
          }

          try {
            await supabase.from('products').upsert(productToSupabaseRow(prod));
          } catch (e) {
            setProducts(prev => [prod, ...prev]);
          }

          if (prod.status === 'published') {
            publishedCount++;
            approvedCount++;
            batchLogs.push({ timestamp: new Date().toISOString(), level: 'success', message: `Producto Publicado en Tienda: "${prod.title.slice(0, 25)}..."` });
          } else if (prod.status === 'approved' || prod.status === 'ready_for_review') {
            approvedCount++;
            batchLogs.push({ timestamp: new Date().toISOString(), level: 'info', message: `âœ“ Guardado para revisiÃ³n manual (Score: ${prod.traceability?.analysis?.overallScore}/100)` });
          } else {
            rejectedCount++;
            batchLogs.push({ timestamp: new Date().toISOString(), level: 'warn', message: `âœ— Descartado por no cumplir criterios.` });
          }
          setAutopilotLiveLogs([...batchLogs]);
        }
      }

      const completedAt = new Date().toISOString();
      const newRun: AutopilotRun = {
        id: runId,
        startedAt: startTime,
        completedAt,
        status: 'completed',
        trigger: 'manual',
        itemsFound: rawCandidates.length,
        itemsProcessed: rawCandidates.length,
        itemsApproved: approvedCount,
        itemsPublished: publishedCount,
        itemsRejected: rejectedCount,
        durationSeconds: Math.round((new Date(completedAt).getTime() - new Date(startTime).getTime()) / 1000),
        logs: batchLogs
      };

      try {
        await supabase.from('autopilot_runs').upsert({
          id: runId,
          status: 'completed',
          trigger_type: 'manual',
          items_found: rawCandidates.length,
          items_processed: rawCandidates.length,
          items_approved: approvedCount,
          items_published: publishedCount,
          items_rejected: rejectedCount,
          duration_seconds: newRun.durationSeconds,
          created_at: startTime,
          updated_at: completedAt
        });
        setRuns(prev => [newRun, ...prev]);
      } catch (e) {
        setRuns(prev => [newRun, ...prev]);
      }

      batchLogs.push({ timestamp: new Date().toISOString(), level: 'success', message: `Pipeline completado: ${publishedCount} publicados, ${approvedCount} aprobados.` });
      setAutopilotLiveLogs([...batchLogs]);
      showToast(`EjecuciÃ³n de Autopilot finalizada (${publishedCount} publicados, ${approvedCount} aprobados)`, 'success');

    } catch (err: any) {
      console.error('Batch run error:', err);
      batchLogs.push({ timestamp: new Date().toISOString(), level: 'error', message: `Error crÃ­tico en batch: ${err.message}` });
      setAutopilotLiveLogs([...batchLogs]);
      showToast(`Error en la ejecuciÃ³n: ${err.message}`, 'error');
    } finally {
      setIsAutopilotRunning(false);
    }
  };

  return (
    <AppContext.Provider
      value={{
        viewMode,
        setViewMode,
        userRole,
        setUserRole,
        user,
        userProfile,
        isAuthLoading,
        isAuthModalOpen,
        setIsAuthModalOpen,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOutUser,
        products,
        publishedProducts,
        candidateProducts,
        runs,
        settings,
        suppliers,
        orders,
        supplierOrders,
        alerts,
        connectors,
        unreadAlertsCount,
        cart,
        wishlist,
        selectedProduct,
        setSelectedProduct,
        selectedCandidateForReview,
        setSelectedCandidateForReview,
        isLoading,
        isAutopilotRunning,
        activeLogs,
        autopilotLiveLogs,
        runPipelineOnCandidate,
        discoverNewCandidates,
        discoverProducts,
        importProductFromUrl,
        triggerFullAutopilotRun,
        runFullAutopilotBatch,
        approveProduct,
        publishProduct,
        unpublishProduct,
        rejectProduct,
        saveProductEdits,
        deleteProduct,
        updateSettings,
        resetToInitialData,
        performPrePurchaseVerification,
        executeSupplierPurchase,
        markSupplierOrderAsManualBought,
        updateSupplierOrderTracking,
        cancelSupplierOrder,
        resolveAlert,
        dismissAlert,
        createSystemAlert,
        addSupplier,
        updateSupplier,
        deleteSupplier,
        assignSupplierToProduct,
        enhanceProductImageAction,
        batchEnhanceAllImagesAction,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        toggleWishlist,
        placeOrder,
        isCartOpen,
        setIsCartOpen,
        toast,
        setToast,
        toastMessage,
        showToast
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};

