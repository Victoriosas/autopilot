import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  writeBatch
} from 'firebase/firestore';
import {
  signInAnonymously,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import {
  db,
  auth,
  googleProvider,
  syncUserProfile,
  validateFirestoreConnection,
  ensureSettings,
  ensureSuppliers,
  logAuditEvent,
  DEFAULT_SETTINGS,
  getFirebaseErrorMessage
} from '../lib/firebase';
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

interface AppContextType {
  // Navigation & Mode
  viewMode: 'store' | 'admin';
  setViewMode: (mode: 'store' | 'admin') => void;
  userRole: 'admin' | 'customer';
  setUserRole: (role: 'admin' | 'customer') => void;
  user: User | null;
  userProfile: UserProfile | null;
  isAuthLoading: boolean;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;

  // Authentication Actions
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name?: string, roleChoice?: 'admin' | 'customer') => Promise<void>;
  signOutUser: () => Promise<void>;

  // Data
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

  // Autopilot Actions
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

  // Fulfillment & Supplier Orders Actions
  performPrePurchaseVerification: (productId: string, supplierOrderId?: string) => Promise<PrePurchaseVerificationResult | null>;
  executeSupplierPurchase: (supplierOrderId: string) => Promise<void>;
  markSupplierOrderAsManualBought: (supplierOrderId: string, notes?: string, trackingNumber?: string, carrier?: string) => Promise<void>;
  updateSupplierOrderTracking: (supplierOrderId: string, trackingNumber: string, carrier: string) => Promise<void>;
  cancelSupplierOrder: (supplierOrderId: string, reason: string) => Promise<void>;

  // Alerts & Notifications Actions
  resolveAlert: (alertId: string) => Promise<void>;
  dismissAlert: (alertId: string) => Promise<void>;
  createSystemAlert: (alertData: Omit<SystemAlert, 'id' | 'createdAt'>) => Promise<void>;

  // Supplier Management Actions
  addSupplier: (supplierData: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Supplier>;
  updateSupplier: (supplier: Supplier) => Promise<void>;
  deleteSupplier: (supplierId: string) => Promise<void>;
  assignSupplierToProduct: (productId: string, supplierId: string) => Promise<void>;

  // Image Enhancement Pipeline Actions
  enhanceProductImageAction: (productId: string, imageIndex?: number, options?: ImageEnhancementOptions) => Promise<EnhancedImageResult | null>;
  batchEnhanceAllImagesAction: (productId: string, options?: ImageEnhancementOptions) => Promise<void>;

  // E-Commerce Store Actions
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
      showToast('Acceso Restringido: El panel administrativo está reservado para cuentas con rol de Administrador.', 'error');
      setIsAuthModalOpen(true);
      return;
    }
    setViewModeState(mode);
  };

  // DEMO_MODE=false by default - demo data never loads in production
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

  // Authentication Methods
  const signInWithGoogle = async (): Promise<void> => {
    try {
      setIsAuthLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      const profile = await syncUserProfile(result.user);
      setUser(result.user);
      setUserProfile(profile);
      setUserRole(profile.role);
      showToast(`Bienvenido ${result.user.displayName || result.user.email} (${profile.role === 'admin' ? 'Administrador' : 'Cliente'})`, 'success');
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      showToast(`Error al iniciar sesión con Google: ${err.message}`, 'error');
      throw err;
    } finally {
      setIsAuthLoading(false);
    }
  };

  const signInWithEmail = async (email: string, pass: string): Promise<void> => {
    try {
      setIsAuthLoading(true);
      const cleanEmail = email.trim();
      const result = await signInWithEmailAndPassword(auth, cleanEmail, pass);
      const profile = await syncUserProfile(result.user);
      setUser(result.user);
      setUserProfile(profile);
      setUserRole(profile.role);
      showToast(`Sesión iniciada como ${profile.displayName || profile.email} (${profile.role === 'admin' ? 'Administrador' : 'Cliente'})`, 'success');
    } catch (err: any) {
      console.error('Email sign-in error:', err);
      const formattedError = getFirebaseErrorMessage(err);
      showToast(formattedError, 'error');
      throw new Error(formattedError);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name?: string, _roleChoice?: 'admin' | 'customer'): Promise<void> => {
    try {
      setIsAuthLoading(true);
      const cleanEmail = email.trim();
      const result = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
      if (name && name.trim()) {
        try {
          await updateProfile(result.user, { displayName: name.trim() });
        } catch (nameErr) {
          console.warn('Could not update display name in auth:', nameErr);
        }
      }
      // Always create as customer. Admin role must be assigned by existing admin via Firestore /admins collection.
      const profile = await syncUserProfile(result.user, 'customer');
      setUser(result.user);
      setUserProfile(profile);
      setUserRole(profile.role);
      showToast(`Cuenta creada con éxito (Rol: Cliente)`, 'success');
    } catch (err: any) {
      console.error('Email sign-up error:', err);
      const formattedError = getFirebaseErrorMessage(err);
      showToast(formattedError, 'error');
      throw new Error(formattedError);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const signOutUser = async (): Promise<void> => {
    try {
      setIsAuthLoading(true);
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
      setUserRole('customer');
      setViewModeState('store');
      showToast('Has cerrado sesión.', 'info');
      // Sign back in anonymously as customer guest
      try {
        const cred = await signInAnonymously(auth);
        setUser(cred.user);
        const guestProfile = await syncUserProfile(cred.user, 'customer');
        setUserProfile(guestProfile);
        setUserRole('customer');
      } catch (e) {
        console.warn('Anonymous guest sign in fallback:', e);
      }
    } catch (err: any) {
      console.error('Sign out error:', err);
      showToast(`Error al cerrar sesión: ${err.message}`, 'error');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Load Connectors Configuration from backend
  useEffect(() => {
    const fetchConnectors = async () => {
      try {
        const res = await fetch('/api/connectors');
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

  // 1. Initialize Auth & Validate Connection
  useEffect(() => {
    validateFirestoreConnection();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setIsAuthLoading(true);
      if (currentUser) {
        setUser(currentUser);
        try {
          const profile = await syncUserProfile(currentUser);
          setUserProfile(profile);
          setUserRole(profile.role);
        } catch (e) {
          console.warn('Sync user profile error:', e);
        }
      } else {
        // Sign in anonymously as customer guest - NEVER as admin
        try {
          const cred = await signInAnonymously(auth);
          setUser(cred.user);
          const profile = await syncUserProfile(cred.user, 'customer');
          setUserProfile(profile);
          setUserRole('customer');
        } catch (e) {
          console.warn('Anonymous auth fallback:', e);
        }
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Initialize Firestore listeners according to Role-Based Security Rules
  useEffect(() => {
    let unsubProducts: () => void = () => {};
    let unsubRuns: () => void = () => {};
    let unsubOrders: () => void = () => {};
    let unsubSupplierOrders: () => void = () => {};
    let unsubAlerts: () => void = () => {};
    let unsubSettings: () => void = () => {};
    let unsubSuppliers: () => void = () => {};

    const setupFirestore = async () => {
      try {
        // Load Settings (Public read permitted)
        const initialSet = await ensureSettings();
        setSettings(initialSet);

        // Listen for settings changes
        unsubSettings = onSnapshot(
          doc(db, 'settings', 'autopilot_config'),
          (docSnap) => {
            if (docSnap.exists()) {
              setSettings(docSnap.data() as AutopilotSettings);
            }
          },
          (err) => {
            console.warn('Firestore settings listener fallback:', err);
          }
        );

        // Listen to Products (Public read permitted)
        const prodCol = collection(db, 'products');
        unsubProducts = onSnapshot(
          prodCol,
          async (snapshot) => {
            if (snapshot.empty) {
              // In production (DEMO_MODE=false), do NOT auto-seed demo data.
              // Admins must manually add products or use the import flow.
              if (userRole === 'admin' && isDemoMode) {
                console.log('Seeding initial products to Firestore (demo mode)...');
                try {
                  const batch = writeBatch(db);
                  for (const p of INITIAL_PRODUCTS) {
                    const ref = doc(db, 'products', p.id);
                    batch.set(ref, p);
                  }
                  for (const r of INITIAL_RUNS) {
                    const ref = doc(db, 'autopilot_runs', r.id);
                    batch.set(ref, r);
                  }
                  await batch.commit();
                } catch (seedErr) {
                  console.warn('Batch seed error, using memory fallback:', seedErr);
                }
              }
            } else {
              const list: Product[] = [];
              snapshot.forEach((d) => list.push(d.data() as Product));
              list.sort((a, b) => new Date(b.traceability?.updatedAt || 0).getTime() - new Date(a.traceability?.updatedAt || 0).getTime());
              setProducts(list);
            }
            setIsLoading(false);
          },
          (err) => {
            console.warn('Firestore products listener fallback:', err);
            setIsLoading(false);
          }
        );

        // ADMINISTRATIVE ONLY LISTENERS:
        // Strictly protected by Firestore rules: only attach if current userRole is 'admin'
        if (userRole === 'admin') {
          // Load / Ensure Suppliers
          const initialSups = await ensureSuppliers();
          setSuppliers(initialSups);

          // Listen to Suppliers
          const supCol = collection(db, 'suppliers');
          unsubSuppliers = onSnapshot(
            supCol,
            (snapshot) => {
              if (!snapshot.empty) {
                const list: Supplier[] = [];
                snapshot.forEach((d) => list.push(d.data() as Supplier));
                list.sort((a, b) => b.metrics.reliabilityScore - a.metrics.reliabilityScore);
                setSuppliers(list);
              }
            },
            (err) => console.warn('Firestore suppliers listener restricted by RBAC:', err)
          );

          // Listen to Autopilot Runs
          const runsCol = collection(db, 'autopilot_runs');
          unsubRuns = onSnapshot(
            runsCol,
            (snapshot) => {
              const rList: AutopilotRun[] = [];
              snapshot.forEach((d) => rList.push(d.data() as AutopilotRun));
              rList.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
              if (rList.length > 0) setRuns(rList);
            },
            (err) => console.warn('Firestore runs listener restricted by RBAC:', err)
          );

          // Listen to All Customer Orders
          const ordersCol = collection(db, 'orders');
          unsubOrders = onSnapshot(
            ordersCol,
            (snapshot) => {
              const oList: Order[] = [];
              snapshot.forEach((d) => oList.push(d.data() as Order));
              oList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              setOrders(oList);
            },
            (err) => console.warn('Firestore orders listener restricted by RBAC:', err)
          );

          // Listen to Supplier Fulfillment Orders
          const supOrdersCol = collection(db, 'supplier_orders');
          unsubSupplierOrders = onSnapshot(
            supOrdersCol,
            (snapshot) => {
              const list: SupplierOrder[] = [];
              snapshot.forEach((d) => list.push(d.data() as SupplierOrder));
              list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              setSupplierOrders(list);
            },
            (err) => console.warn('Firestore supplier_orders listener restricted by RBAC:', err)
          );

          // Listen to System Alerts
          const alertsCol = collection(db, 'alerts');
          unsubAlerts = onSnapshot(
            alertsCol,
            (snapshot) => {
              const list: SystemAlert[] = [];
              snapshot.forEach((d) => list.push(d.data() as SystemAlert));
              list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              setAlerts(list);
            },
            (err) => console.warn('Firestore alerts listener restricted by RBAC:', err)
          );
        } else {
          // CUSTOMER SCOPE:
          // Customers only listen to their own orders (matching Firestore security rules)
          if (user?.uid) {
            const userOrdersQuery = query(collection(db, 'orders'), where('userId', '==', user.uid));
            unsubOrders = onSnapshot(
              userOrdersQuery,
              (snapshot) => {
                const oList: Order[] = [];
                snapshot.forEach((d) => oList.push(d.data() as Order));
                oList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                setOrders(oList);
              },
              (err) => console.warn('Customer personal orders listener error:', err)
            );
          }
        }

      } catch (err) {
        console.warn('Firestore sync failed, using offline state:', err);
        setIsLoading(false);
      }
    };

    setupFirestore();

    return () => {
      unsubProducts();
      unsubRuns();
      unsubOrders();
      unsubSupplierOrders();
      unsubAlerts();
      unsubSettings();
      unsubSuppliers();
    };
  }, [userRole, user?.uid]);

  // Filtered product views
  const publishedProducts = products.filter((p) => p.status === 'published');
  const candidateProducts = products.filter((p) => p.status !== 'published');

  // Autopilot Actions
  const runPipelineOnCandidate = async (candidate: Product): Promise<Product | null> => {
    try {
      showToast(`Autopilot analizando "${candidate.title.slice(0, 30)}..."`, 'info');
      // Mark as analyzing first in Firestore
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
              action: 'Inicio de análisis multi-etapa por Autopilot',
              actor: 'Autopilot Coordinator'
            }
          ]
        }
      };

      try {
        await setDoc(doc(db, 'products', candidate.id), updatedCandidate);
      } catch (e) {
        console.warn('Direct firestore update failed:', e);
      }

      // Call Express server AI pipeline
      const res = await fetch('/api/autopilot/analyze', {
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
        // Save result in Firestore
        try {
          await setDoc(doc(db, 'products', transformed.id), transformed);
          await logAuditEvent('AUTOPILOT_ANALYZE_COMPLETE', transformed.id, {
            score: transformed.traceability?.analysis?.overallScore,
            status: transformed.status,
            price: transformed.price
          });
        } catch (dbErr) {
          console.warn('Firestore set failed, updating local state:', dbErr);
          setProducts((prev) => prev.map((p) => (p.id === transformed.id ? transformed : p)));
        }

        if (transformed.status === 'published') {
          showToast(`¡"${transformed.title.slice(0, 30)}..." aprobado y publicado en Victoriosa!`, 'success');
        } else if (transformed.status === 'ready_for_review') {
          showToast(`Análisis completado. Listo para revisión manual en el panel.`, 'info');
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
      showToast('Autopilot explorando fuentes globales de catálogo...', 'info');

      const res = await fetch('/api/autopilot/discover', {
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
            category: raw.rawCategory || category || 'Tecnología & Gadgets',
            tags: ['Descubrimiento', raw.sourcePlatform || 'Marketplace'],
            brand: 'Victoriosa',
            description: raw.productConcept || 'Candidato detectado en fuentes de comercio global.',
            originalDescription: raw.productConcept,
            features: raw.rawFeatures || ['Características en proceso de extracción y validación'],
            specs: {
              'Fuente': raw.sourcePlatform || 'Global Feed',
              'Proveedor': raw.supplierName || 'Distribuidor Mayorista',
              'País Origen': raw.supplierCountry || 'UE / Global'
            },
            images: raw.rawImages || ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&auto=format&fit=crop&q=80'],
            originalImages: raw.rawImages || [],
            price: raw.costPriceEur ? +(raw.costPriceEur * 2.4).toFixed(2) : 49.95,
            costPrice: raw.costPriceEur || 20,
            inventory: 30,
            sku: raw.sourceSku || `RAW-${Math.floor(Math.random() * 89999 + 10000)}`,
            badges: ['Oportunidad Recién Detectada'],
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
                country: raw.supplierCountry || 'España / UE',
                shippingDaysMin: raw.shippingDaysMin || 2,
                shippingDaysMax: raw.shippingDaysMax || 5,
                returnPolicy: '30 días'
              },
              pricing: {
                originalCostEur: raw.costPriceEur || 20,
                originalCurrency: 'EUR',
                supplierShippingCost: raw.supplierShippingCost || 3.5,
                estimatedCustoms: 0.8,
                gatewayFee: 1.5,
                targetMarginPct: 55,
                suggestedPrice: +( (raw.costPriceEur || 20) * 2.3 ).toFixed(2),
                retailPrice: +( (raw.costPriceEur || 20) * 2.3 ).toFixed(2),
                potentialProfit: +( (raw.costPriceEur || 20) * 1.2 ).toFixed(2),
                psychologicalEnding: '95'
              },
              analysis: {
                demandScore: 85,
                competitionLevel: 'medium',
                marginPotential: 88,
                brandFitScore: 84,
                brandFitJustification: 'Pendiente de análisis completo por Gemini.',
                qualityScore: 86,
                logisticsScore: 88,
                overallScore: 85,
                scoreTier: 'A',
                targetAudience: 'Compradores Victoriosa',
                keySellingPoints: ['Potencial de margen saludable', 'Buena reputación de origen'],
                validatedClaims: [],
                potentialIssues: []
              },
              risk: {
                level: 'low',
                copyrightRisk: 'none',
                claimsRisk: 'safe',
                supplierRisk: 'safe',
                returnRisk: 'low',
                details: ['Pendiente de moderación automática.']
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
            await setDoc(doc(db, 'products', candidateProduct.id), candidateProduct);
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
      { timestamp: new Date().toISOString(), level: 'info', message: `Iniciando ejecución completa de Autopilot (${runId}).` },
      { timestamp: new Date().toISOString(), level: 'info', message: `Filtros: Categoría "${category || 'Todas'}", Fuente "${source || 'Multi-Fuente'}".` }
    ];
    setAutopilotLiveLogs([...logs]);

    try {
      // Step 1: Discover
      logs.push({ timestamp: new Date().toISOString(), level: 'info', message: 'Fase 1/3: Descubriendo nuevos candidatos...' });
      setAutopilotLiveLogs([...logs]);
      
      const discRes = await fetch('/api/autopilot/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, source, count: 2 })
      });
      const discData = await discRes.json();
      const rawCandidates = discData.candidates || [];
      
      logs.push({ timestamp: new Date().toISOString(), level: 'success', message: `Fase 1 completada: ${rawCandidates.length} oportunidades identificadas.` });
      setAutopilotLiveLogs([...logs]);

      // Step 2: Analyze & Process each candidate
      let approvedCount = 0;
      let publishedCount = 0;
      let rejectedCount = 0;

      for (let i = 0; i < rawCandidates.length; i++) {
        const item = rawCandidates[i];
        logs.push({ timestamp: new Date().toISOString(), level: 'info', message: `Fase 2/3: Analizando candidato [${i + 1}/${rawCandidates.length}] "${item.originalTitle.slice(0, 30)}..."` });
        setAutopilotLiveLogs([...logs]);

        const analyzeRes = await fetch('/api/autopilot/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidate: item, settings })
        });
        const analyzeData = await analyzeRes.json();

        if (analyzeData.success && analyzeData.product) {
          const prod: Product = analyzeData.product;
          try {
            await setDoc(doc(db, 'products', prod.id), prod);
          } catch (e) {
            setProducts((prev) => [prod, ...prev]);
          }

          if (prod.status === 'published') {
            publishedCount++;
            approvedCount++;
            logs.push({ timestamp: new Date().toISOString(), level: 'success', message: `✓ Aprobado y Publicado: "${prod.title.slice(0, 25)}..." (Score: ${prod.traceability.analysis.overallScore})` });
          } else if (prod.status === 'approved') {
            approvedCount++;
            logs.push({ timestamp: new Date().toISOString(), level: 'success', message: `✓ Aprobado para Draft: "${prod.title.slice(0, 25)}..."` });
          } else if (prod.status === 'rejected') {
            rejectedCount++;
            logs.push({ timestamp: new Date().toISOString(), level: 'warn', message: `✗ Rechazado: Riesgo o margen no apto.` });
          } else {
            logs.push({ timestamp: new Date().toISOString(), level: 'info', message: `→ En espera de revisión manual (Score: ${prod.traceability?.analysis?.overallScore || 'N/A'})` });
          }
          setAutopilotLiveLogs([...logs]);
        }
      }

      // Step 3: Complete Run Summary
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
        await setDoc(doc(db, 'autopilot_runs', runId), newRun);
      } catch (e) {
        setRuns((prev) => [newRun, ...prev]);
      }

      logs.push({ timestamp: new Date().toISOString(), level: 'success', message: `Ejecución finalizada con éxito. ${publishedCount} productos nuevos en Victoriosa.` });
      setAutopilotLiveLogs([...logs]);
      showToast(`Ejecución de Autopilot finalizada: ${publishedCount} publicados, ${approvedCount} aprobados.`, 'success');

    } catch (err: any) {
      console.error('Autopilot run error:', err);
      logs.push({ timestamp: new Date().toISOString(), level: 'error', message: `Error en la ejecución: ${err.message}` });
      setAutopilotLiveLogs([...logs]);
      showToast(`Fallo en ejecución del Autopilot: ${err.message}`, 'error');
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
            action: autoPublish ? 'Aprobado y publicado en tienda pública' : 'Aprobado por el Administrador',
            actor: 'Administrador (Panel Victoriosa)'
          }
        ]
      }
    };

    try {
      await setDoc(doc(db, 'products', productId), updated);
      await logAuditEvent(autoPublish ? 'PRODUCT_PUBLISHED_MANUAL' : 'PRODUCT_APPROVED_MANUAL', productId, {
        previousStatus: target.status,
        newStatus
      });
    } catch (e) {
      setProducts((prev) => prev.map((p) => (p.id === productId ? updated : p)));
    }

    showToast(autoPublish ? `"${target.title.slice(0, 30)}..." ya está visible en la tienda pública.` : `Producto aprobado exitosamente.`, 'success');
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
            action: 'Despublicado del catálogo público (movido a borrador)',
            actor: 'Administrador (Panel Victoriosa)'
          }
        ]
      }
    };

    try {
      await setDoc(doc(db, 'products', productId), updated);
      await logAuditEvent('PRODUCT_UNPUBLISHED', productId, { previousStatus: target.status });
    } catch (e) {
      setProducts((prev) => prev.map((p) => (p.id === productId ? updated : p)));
    }

    showToast(`El producto ha sido despublicado y retirado de la tienda pública.`, 'info');
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
            actor: 'Administrador (Moderación Manual)'
          }
        ]
      }
    };

    try {
      await setDoc(doc(db, 'products', productId), updated);
      await logAuditEvent('PRODUCT_REJECTED', productId, { reason });
    } catch (e) {
      setProducts((prev) => prev.map((p) => (p.id === productId ? updated : p)));
    }

    showToast(`Producto marcado como rechazado. No se publicará.`, 'error');
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
            action: 'Edición manual de campos (título, precio o especificaciones)',
            actor: 'Administrador'
          }
        ]
      }
    };

    try {
      await setDoc(doc(db, 'products', product.id), updated);
      await logAuditEvent('PRODUCT_MANUAL_EDIT', product.id, { title: product.title, price: product.price });
    } catch (e) {
      setProducts((prev) => prev.map((p) => (p.id === product.id ? updated : p)));
    }

    showToast('Cambios guardados correctamente en Firestore.', 'success');
  };

  const deleteProduct = async (productId: string) => {
    try {
      await deleteDoc(doc(db, 'products', productId));
      await logAuditEvent('PRODUCT_DELETED', productId, {});
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
      await setDoc(doc(db, 'settings', 'autopilot_config'), merged);
      showToast('Configuración del Autopilot actualizada.', 'success');
    } catch (e) {
      console.warn('Failed to save settings to Firestore:', e);
    }
  };

  const resetToInitialData = async () => {
    // Reset only works in demo mode - in production, this is a no-op
    if (!isDemoMode) {
      showToast('Reset no disponible en modo producción.', 'error');
      return;
    }
    try {
      const batch = writeBatch(db);
      for (const p of INITIAL_PRODUCTS) {
        batch.set(doc(db, 'products', p.id), p);
      }
      for (const r of INITIAL_RUNS) {
        batch.set(doc(db, 'autopilot_runs', r.id), r);
      }
      await batch.commit();
      setProducts(INITIAL_PRODUCTS);
      setRuns(INITIAL_RUNS);
      showToast('Base de datos restablecida con datos iniciales verificados.', 'success');
    } catch (e) {
      setProducts(INITIAL_PRODUCTS);
      setRuns(INITIAL_RUNS);
    }
  };

  // E-Commerce Cart Actions
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
    showToast(`"${product.title.slice(0, 25)}..." añadido a tu bolsa`, 'success');
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

  const placeOrder = async (customerData: any, paymentId?: string): Promise<Order | null> => {
    if (cart.length === 0) return null;

    // USD conversion
    const exchangeRate = 1.08;
    const subtotalEur = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
    const shippingEur = subtotalEur >= 80 ? 0 : 5.95;
    const discount = 0;
    const subtotalUsd = +(subtotalEur * exchangeRate).toFixed(2);
    const shippingUsd = +(shippingEur * exchangeRate).toFixed(2);
    const totalUsd = +(subtotalUsd + shippingUsd - discount).toFixed(2);

    const orderId = `VIC-ORD-${Date.now().toString().slice(-6)}`;

    // Payment status determined by whether paymentId is provided (from server capture)
    const isPaid = !!paymentId;

    const newOrder: Order = {
      id: orderId,
      orderNumber: orderId,
      customer: customerData,
      items: cart.map((item) => ({
        productId: item.product.id,
        title: item.product.title,
        price: item.product.price,
        quantity: item.quantity,
        image: item.product.images[0] || '',
        selectedVariant: item.selectedVariant,
        sku: item.product.sku
      })),
      subtotal: subtotalUsd,
      shippingCost: shippingUsd,
      discount,
      total: totalUsd,
      currency: 'USD',
      paymentMethod: 'paypal',
      paymentStatus: isPaid ? 'paid' : 'pending',
      paymentId: paymentId || undefined,
      paymentGateway: isPaid ? 'paypal' : undefined,
      status: isPaid ? 'confirmed' : 'pending_payment',
      trackingNumber: '',
      estimatedDelivery: '',
      createdAt: new Date().toISOString(),
      userId: user?.uid
    };

    try {
      await setDoc(doc(db, 'orders', orderId), newOrder);
      await logAuditEvent('ORDER_CREATED', orderId, { total: totalUsd, currency: 'USD', itemCount: cart.length });
    } catch (e) {
      setOrders((prev) => [newOrder, ...prev]);
    }

    // 🌟 REAL FULFILLMENT & PRE-PURCHASE DISPATCH PIPELINE FOR EACH ITEM
    for (const item of cart) {
      const prod = item.product;
      const sourcePlatform = prod.traceability?.source?.platform || 'Supplier Hub B2B';
      const isAutoSupported = sourcePlatform === 'Supplier Hub B2B';

      const unitCost = prod.costPrice || 25.00;
      const unitShipping = prod.traceability?.pricing?.supplierShippingCost || 3.50;
      const totalCost = +( (unitCost * item.quantity) + unitShipping ).toFixed(2);
      const totalRevenue = +(item.product.price * item.quantity).toFixed(2);
      const estimatedMargin = +( ((totalRevenue - totalCost) / totalRevenue) * 100 ).toFixed(1);

      const supplierOrderId = `SUP-ORD-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5)}`;
      
      const verificationData: PrePurchaseVerificationResult = {
        passed: false,
        checkedAt: new Date().toISOString(),
        productId: prod.id,
        productTitle: prod.title,
        sourceUrl: prod.traceability?.source?.url || '',
        supplierName: prod.traceability?.supplier?.name || 'Proveedor Homologado',
        sourcePlatform,
        inStock: false,
        stockAvailableQuantity: undefined,
        expectedCost: unitCost,
        liveCost: unitCost,
        priceDeltaEur: 0,
        priceDeltaPercentage: 0,
        expectedShippingCost: unitShipping,
        liveShippingCost: unitShipping,
        shippingDeltaEur: 0,
        salePrice: prod.price,
        estimatedNetProfit: +(totalRevenue - totalCost).toFixed(2),
        estimatedNetMarginPct: Number(estimatedMargin),
        marginHealthy: Number(estimatedMargin) >= 30,
        flags: ['REQUIRES_HUMAN_ACTION', 'UNVERIFIED_STOCK'],
        actionRequired: 'HUMAN_APPROVAL_REQUIRED',
        notes: `Verificación pendiente. El stock y precio deben ser confirmados manualmente para ${sourcePlatform}.`
      };

      const supplierOrderDoc: SupplierOrder = {
        id: supplierOrderId,
        orderId,
        productId: prod.id,
        productTitle: prod.title,
        productSku: prod.sku,
        quantity: item.quantity,
        selectedVariant: item.selectedVariant,
        sourcePlatform,
        sourceUrl: prod.traceability?.source?.url || '',
        sourceSku: prod.traceability?.source?.sku || prod.sku,
        supplierName: prod.traceability?.supplier?.name || 'Proveedor B2B',
        unitCostEur: unitCost,
        shippingCostEur: unitShipping,
        totalCostEur: totalCost,
        salePriceEur: prod.price,
        totalRevenueEur: totalRevenue,
        estimatedMarginPct: Number(estimatedMargin),
        customerShippingAddress: {
          fullName: customerData.fullName || 'Cliente Victoriosa',
          address: customerData.address || '',
          city: customerData.city || '',
          postalCode: customerData.postalCode || '',
          country: customerData.country || 'España',
          phone: customerData.phone || ''
        },
        status: isAutoSupported ? 'pending_verification' : 'human_action_required',
        prePurchaseVerification: verificationData,
        supplierOrderReference: undefined,
        trackingNumber: undefined,
        carrier: undefined,
        humanActionReason: isAutoSupported ? undefined : `Plataforma ${sourcePlatform} requiere compra asistida por el operador.`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      try {
        await setDoc(doc(db, 'supplier_orders', supplierOrderId), supplierOrderDoc);
        await logAuditEvent('SUPPLIER_ORDER_CREATED', supplierOrderId, {
          orderId,
          productId: prod.id,
          status: supplierOrderDoc.status
        });
      } catch (err) {
        console.warn('Firestore write supplier_orders fallback:', err);
      }

      // If human action required, raise a real alert
      if (!isAutoSupported) {
        const alertId = `alt-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5)}`;
        const alertDoc: SystemAlert = {
          id: alertId,
          type: 'PURCHASE_REQUIRES_HUMAN',
          severity: 'critical',
          title: `Acción Requerida: Compra manual en ${sourcePlatform}`,
          message: `El pedido ${orderId} contiene el producto "${prod.title.slice(0, 30)}..." en ${sourcePlatform}. Se requiere compra asistida por el operador.`,
          productId: prod.id,
          productTitle: prod.title,
          supplierOrderId,
          sourcePlatform,
          actionLink: prod.traceability?.source?.url || '',
          resolved: false,
          dismissed: false,
          createdAt: new Date().toISOString()
        };

        try {
          await setDoc(doc(db, 'alerts', alertId), alertDoc);
        } catch (e) {
          console.warn('Firestore write alert fallback:', e);
        }
      }
    }

    clearCart();
    return newOrder;
  };

  // Pre-Purchase Real Verification Function
  const performPrePurchaseVerification = async (productId: string, supplierOrderId?: string): Promise<PrePurchaseVerificationResult | null> => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return null;

    const sourcePlatform = prod.traceability?.source?.platform || 'Supplier Hub B2B';
    const cost = prod.costPrice || 25.00;
    const shipping = prod.traceability?.pricing?.supplierShippingCost || 3.50;

    try {
      showToast(`Verificando stock y margen en tiempo real con ${sourcePlatform}...`, 'info');
      const res = await fetch('/api/fulfillment/verify', {
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
          const supOrderRef = doc(db, 'supplier_orders', supplierOrderId);
          await updateDoc(supOrderRef, {
            prePurchaseVerification: verification,
            updatedAt: new Date().toISOString()
          });
        }

        showToast(
          verification.passed ? '✓ Verificación previa superada: Stock confirmado' : '⚠ Verificación alertó margen o stock',
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

  // Execute Supplier Purchase
  const executeSupplierPurchase = async (supplierOrderId: string): Promise<void> => {
    const sOrder = supplierOrders.find(o => o.id === supplierOrderId);
    if (!sOrder) return;

    try {
      showToast(`Conectando con proveedor para tramitar pedido #${supplierOrderId.slice(-6)}...`, 'info');
      const res = await fetch('/api/fulfillment/create-supplier-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierOrder: sOrder })
      });

      const data = await res.json();
      const now = new Date().toISOString();

      if (data.status === 'order_placed') {
        const updatedOrder: Partial<SupplierOrder> = {
          status: 'order_placed',
          supplierOrderReference: data.supplierOrderReference,
          trackingNumber: data.trackingNumber,
          carrier: data.carrier,
          updatedAt: now
        };

        await setDoc(doc(db, 'supplier_orders', supplierOrderId), { ...sOrder, ...updatedOrder });
        await logAuditEvent('SUPPLIER_ORDER_PLACED', supplierOrderId, { reference: data.supplierOrderReference });
        showToast(`✓ Pedido a proveedor completado con éxito (Ref: ${data.supplierOrderReference})`, 'success');
      } else {
        const updatedOrder: Partial<SupplierOrder> = {
          status: 'human_action_required',
          humanActionReason: data.humanActionReason || 'Requiere compra manual en el marketplace.',
          updatedAt: now
        };
        await setDoc(doc(db, 'supplier_orders', supplierOrderId), { ...sOrder, ...updatedOrder });
        showToast('Acción requerida: La orden requiere compra manual por operador.', 'info');
      }
    } catch (err: any) {
      console.error('Execute supplier purchase error:', err);
      showToast(`Error al tramitar con proveedor: ${err.message}`, 'error');
    }
  };

  // Mark Supplier Order as Manual Bought
  const markSupplierOrderAsManualBought = async (
    supplierOrderId: string, 
    notes?: string, 
    trackingNumber?: string, 
    carrier: string = 'Correos Express / DHL'
  ): Promise<void> => {
    const sOrder = supplierOrders.find(o => o.id === supplierOrderId);
    if (!sOrder) return;

    const now = new Date().toISOString();
    const updated: SupplierOrder = {
      ...sOrder,
      status: trackingNumber ? 'shipped' : 'order_placed',
      supplierOrderReference: notes || `MANUAL-BUY-${Date.now().toString().slice(-5)}`,
      trackingNumber: trackingNumber || sOrder.trackingNumber,
      carrier: carrier || sOrder.carrier,
      updatedAt: now
    };

    try {
      await setDoc(doc(db, 'supplier_orders', supplierOrderId), updated);
      await logAuditEvent('SUPPLIER_ORDER_MANUAL_BOUGHT', supplierOrderId, { notes, trackingNumber });
      
      // Auto resolve related alert
      const relAlert = alerts.find(a => a.supplierOrderId === supplierOrderId && !a.resolved);
      if (relAlert) {
        await setDoc(doc(db, 'alerts', relAlert.id), { ...relAlert, resolved: true, resolvedAt: now });
      }

      showToast(`Orden #${supplierOrderId.slice(-6)} marcada como comprada exitosamente.`, 'success');
    } catch (err: any) {
      console.warn('Firestore update supplier order error:', err);
    }
  };

  // Update Supplier Tracking
  const updateSupplierOrderTracking = async (supplierOrderId: string, trackingNumber: string, carrier: string): Promise<void> => {
    const sOrder = supplierOrders.find(o => o.id === supplierOrderId);
    if (!sOrder) return;

    const now = new Date().toISOString();
    const updated: SupplierOrder = {
      ...sOrder,
      status: 'shipped',
      trackingNumber,
      carrier,
      updatedAt: now
    };

    try {
      await setDoc(doc(db, 'supplier_orders', supplierOrderId), updated);
      await logAuditEvent('SUPPLIER_ORDER_TRACKING_UPDATED', supplierOrderId, { trackingNumber, carrier });
      showToast(`Seguimiento actualizado para #${supplierOrderId.slice(-6)}: ${trackingNumber}`, 'success');
    } catch (err: any) {
      console.warn('Firestore update tracking error:', err);
    }
  };

  // Cancel Supplier Order
  const cancelSupplierOrder = async (supplierOrderId: string, reason: string): Promise<void> => {
    const sOrder = supplierOrders.find(o => o.id === supplierOrderId);
    if (!sOrder) return;

    const now = new Date().toISOString();
    const updated: SupplierOrder = {
      ...sOrder,
      status: 'cancelled',
      humanActionReason: `Cancelado: ${reason}`,
      updatedAt: now
    };

    try {
      await setDoc(doc(db, 'supplier_orders', supplierOrderId), updated);
      await logAuditEvent('SUPPLIER_ORDER_CANCELLED', supplierOrderId, { reason });
      showToast(`Orden #${supplierOrderId.slice(-6)} cancelada.`, 'info');
    } catch (err: any) {
      console.warn('Firestore cancel order error:', err);
    }
  };

  // Resolve Alert
  const resolveAlert = async (alertId: string): Promise<void> => {
    const alert = alerts.find(a => a.id === alertId);
    if (!alert) return;

    const updated: SystemAlert = {
      ...alert,
      resolved: true,
      resolvedAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'alerts', alertId), updated);
      showToast('Alerta marcada como resuelta.', 'success');
    } catch (err: any) {
      console.warn('Firestore resolve alert error:', err);
    }
  };

  // Dismiss Alert
  const dismissAlert = async (alertId: string): Promise<void> => {
    const alert = alerts.find(a => a.id === alertId);
    if (!alert) return;

    const updated: SystemAlert = {
      ...alert,
      dismissed: true
    };

    try {
      await setDoc(doc(db, 'alerts', alertId), updated);
      showToast('Alerta descartada.', 'info');
    } catch (err: any) {
      console.warn('Firestore dismiss alert error:', err);
    }
  };

  // Create System Alert
  const createSystemAlert = async (alertData: Omit<SystemAlert, 'id' | 'createdAt'>): Promise<void> => {
    const alertId = `alt-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5)}`;
    const newAlert: SystemAlert = {
      ...alertData,
      id: alertId,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'alerts', alertId), newAlert);
    } catch (err: any) {
      console.warn('Firestore create alert error:', err);
    }
  };

  // Import Product Directly from URL
  const importProductFromUrl = async (url: string): Promise<Product | null> => {
    try {
      showToast('Extrayendo metadatos de la URL con Autopilot...', 'info');
      const res = await fetch('/api/connectors/direct-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const data = await res.json();
      if (data.success && data.candidate) {
        showToast('Analizando producto con IA y aplicando identidad Victoriosa...', 'info');
        const analyzed = await runPipelineOnCandidate(data.candidate);
        if (analyzed) {
          showToast(`¡Producto "${analyzed.title.slice(0, 25)}..." importado con éxito!`, 'success');
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

  // Discover Products Method for Modals
  const discoverProducts = async (category?: string, source?: string, count: number = 3, keyword?: string): Promise<void> => {
    await discoverNewCandidates(category, source, keyword);
  };

  // Supplier Management Actions
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
      await setDoc(doc(db, 'suppliers', newId), newSupplier);
      await logAuditEvent('SUPPLIER_CREATED', newId, { name: newSupplier.name, code: newSupplier.code });
      setSuppliers(prev => [newSupplier, ...prev]);
      showToast(`Proveedor "${newSupplier.name}" registrado correctamente en Firestore.`, 'success');
      return newSupplier;
    } catch (err: any) {
      console.warn('Firestore write supplier error, updating local state:', err);
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
      await setDoc(doc(db, 'suppliers', supplier.id), updated);
      await logAuditEvent('SUPPLIER_UPDATED', supplier.id, { name: supplier.name, reliabilityScore: supplier.metrics.reliabilityScore });
      setSuppliers(prev => prev.map(s => s.id === supplier.id ? updated : s));
      showToast(`Acuerdos y datos de "${supplier.name}" actualizados.`, 'success');
    } catch (err: any) {
      console.warn('Firestore update supplier error:', err);
      setSuppliers(prev => prev.map(s => s.id === supplier.id ? updated : s));
    }
  };

  const deleteSupplier = async (supplierId: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, 'suppliers', supplierId));
      await logAuditEvent('SUPPLIER_DELETED', supplierId, {});
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

    // Recalculate margins based on supplier's volume discount and shipping
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
          shippingDaysMin: sup.pricingAgreements.leadTimeDaysMin,
          shippingDaysMax: sup.pricingAgreements.leadTimeDaysMax,
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
      await setDoc(doc(db, 'products', productId), updated);
      await logAuditEvent('PRODUCT_SUPPLIER_ASSIGNED', productId, { supplierId: sup.id, supplierName: sup.name });
      setProducts(prev => prev.map(p => p.id === productId ? updated : p));
      showToast(`Proveedor "${sup.name}" vinculado a "${prod.title.slice(0, 25)}..."`, 'success');
    } catch (e) {
      setProducts(prev => prev.map(p => p.id === productId ? updated : p));
    }
  };

  // Image Enhancement Pipeline Actions
  const enhanceProductImageAction = async (
    productId: string,
    imageIndex: number = 0,
    options?: ImageEnhancementOptions
  ): Promise<EnhancedImageResult | null> => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return null;

    try {
      showToast(`Procesando optimización de imagen #${imageIndex + 1}...`, 'info');
      const { enhancedResult, updatedProduct } = await enhanceAndPersistProductImage(prod, imageIndex, options);

      // Persist in Cloud Firestore
      try {
        await setDoc(doc(db, 'products', productId), updatedProduct);
        await logAuditEvent('PRODUCT_IMAGE_ENHANCED', productId, {
          imageIndex,
          appliedFilters: enhancedResult.appliedFilters,
          dimensions: enhancedResult.dimensions
        });
      } catch (dbErr) {
        console.warn('Firestore product image update notice:', dbErr);
      }

      setProducts(prev => prev.map(p => p.id === productId ? updatedProduct : p));
      showToast(`¡Imagen #${imageIndex + 1} optimizada y guardada en Firebase!`, 'success');
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

    showToast(`Iniciando retocado por lotes de ${prod.images.length} imágenes...`, 'info');
    let currentProd = prod;
    for (let i = 0; i < currentProd.images.length; i++) {
      const { updatedProduct } = await enhanceAndPersistProductImage(currentProd, i, options);
      currentProd = updatedProduct;
    }

    try {
      await setDoc(doc(db, 'products', productId), currentProd);
    } catch (e) {
      console.warn('Firestore batch image set error:', e);
    }

    setProducts(prev => prev.map(p => p.id === productId ? currentProd : p));
    showToast(`Todas las imágenes (${currentProd.images.length}) han sido optimizadas con éxito.`, 'success');
  };

  const runFullAutopilotBatch = async ({
    category = 'Relojería',
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
      { timestamp: new Date().toISOString(), level: 'info', message: `🚀 Autopilot Batch Run (${runId}) inicializado.` },
      { timestamp: new Date().toISOString(), level: 'info', message: `Parámetros: Categoría "${category}", Lote ${maxCandidates} ítems, Margen Min ${targetMarginPct}%.` }
    ];
    setAutopilotLiveLogs([...batchLogs]);

    try {
      // 1. Discovery
      batchLogs.push({ timestamp: new Date().toISOString(), level: 'info', message: `Etapa 1/4: Descubriendo ${maxCandidates} candidatos en fuentes globales...` });
      setAutopilotLiveLogs([...batchLogs]);

      const discRes = await fetch('/api/autopilot/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, count: maxCandidates })
      });
      const discData = await discRes.json();
      const rawCandidates = discData.candidates?.slice(0, maxCandidates) || [];

      batchLogs.push({ timestamp: new Date().toISOString(), level: 'success', message: `✓ Etapa 1 completada: ${rawCandidates.length} oportunidades extraídas.` });
      setAutopilotLiveLogs([...batchLogs]);

      let approvedCount = 0;
      let publishedCount = 0;
      let rejectedCount = 0;

      // 2. Process Candidates through 12-stage pipeline
      for (let i = 0; i < rawCandidates.length; i++) {
        const item = rawCandidates[i];
        batchLogs.push({ timestamp: new Date().toISOString(), level: 'info', message: `Etapa 2/4: Evaluando [${i + 1}/${rawCandidates.length}] "${item.originalTitle.slice(0, 28)}..." con Gemini AI...` });
        setAutopilotLiveLogs([...batchLogs]);

        // Cross-reference supplier from Firestore
        const matchedSupplier = suppliers.find(s => 
          s.catalogs.categories.some(c => c.toLowerCase().includes(category.toLowerCase())) ||
          s.name.toLowerCase().includes((item.supplierName || '').toLowerCase())
        );

        if (matchedSupplier) {
          item.supplierName = matchedSupplier.name;
          item.supplierReliability = matchedSupplier.metrics.reliabilityScore;
          item.supplierCountry = matchedSupplier.contact.country;
          item.supplierShippingCost = matchedSupplier.pricingAgreements.avgShippingPerUnit;
          batchLogs.push({ timestamp: new Date().toISOString(), level: 'success', message: `✓ Proveedor verificado en base de datos: ${matchedSupplier.name} (Score: ${matchedSupplier.metrics.reliabilityScore}%)` });
          setAutopilotLiveLogs([...batchLogs]);
        }

        const analyzeRes = await fetch('/api/autopilot/analyze', {
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

          // Etapa 3: Auto Image Enhancement
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
              batchLogs.push({ timestamp: new Date().toISOString(), level: 'success', message: `✓ Imagen de producto optimizada en estudio digital (1000x1000px, Obsidian Dark)` });
              setAutopilotLiveLogs([...batchLogs]);
            }
          } catch (imgErr) {
            console.warn('Image auto-enhancement warning:', imgErr);
          }

          // Save to Firestore
          try {
            await setDoc(doc(db, 'products', prod.id), prod);
          } catch (e) {
            setProducts(prev => [prod, ...prev]);
          }

          if (prod.status === 'published') {
            publishedCount++;
            approvedCount++;
            batchLogs.push({ timestamp: new Date().toISOString(), level: 'success', message: `🌟 Producto Publicado en Tienda: "${prod.title.slice(0, 25)}..."` });
          } else if (prod.status === 'approved' || prod.status === 'ready_for_review') {
            approvedCount++;
            batchLogs.push({ timestamp: new Date().toISOString(), level: 'info', message: `✓ Guardado para revisión manual (Score: ${prod.traceability?.analysis?.overallScore}/100)` });
          } else {
            rejectedCount++;
            batchLogs.push({ timestamp: new Date().toISOString(), level: 'warn', message: `✗ Descartado por no cumplir criterios.` });
          }
          setAutopilotLiveLogs([...batchLogs]);
        }
      }

      // 4. Save Run History
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
        await setDoc(doc(db, 'autopilot_runs', runId), newRun);
        setRuns(prev => [newRun, ...prev]);
      } catch (e) {
        setRuns(prev => [newRun, ...prev]);
      }

      batchLogs.push({ timestamp: new Date().toISOString(), level: 'success', message: `🎉 Pipeline completado: ${publishedCount} publicados, ${approvedCount} aprobados.` });
      setAutopilotLiveLogs([...batchLogs]);
      showToast(`Ejecución de Autopilot finalizada (${publishedCount} publicados, ${approvedCount} aprobados)`, 'success');

    } catch (err: any) {
      console.error('Batch run error:', err);
      batchLogs.push({ timestamp: new Date().toISOString(), level: 'error', message: `Error crítico en batch: ${err.message}` });
      setAutopilotLiveLogs([...batchLogs]);
      showToast(`Error en la ejecución: ${err.message}`, 'error');
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
