import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import {
  getAuth,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import {
  getStorage,
  ref as storageRef,
  uploadString,
  uploadBytes,
  getDownloadURL
} from 'firebase/storage';
import type { Product, AutopilotRun, AutopilotSettings, Order, UserProfile, Supplier } from '../types';
import { INITIAL_SUPPLIERS } from '../data/initialSuppliers';

// Read config from firebase-applet-config.json or fallback
const firebaseConfig = {
  projectId: "gen-lang-client-0083794665",
  appId: "1:114265039711:web:aca7257e03abc319fc0cea",
  apiKey: "AIzaSyCreoqf2YzzkWDnvEOTWDelA-ZTICFx0ac",
  authDomain: "gen-lang-client-0083794665.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-victoriosa-f5629295-082e-4e55-a74f-7d70e1b7db16",
  storageBucket: "gen-lang-client-0083794665.firebasestorage.app",
  messagingSenderId: "114265039711"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
export const storage = getStorage(app);

// Authentication Providers
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Admin authorization is determined ONLY by /admins/{uid} document in Firestore.
// No hardcoded emails. No email-based admin escalation.
// To bootstrap the first admin, manually create the /admins/{uid} document via Firebase Console.
export function isStaffAdminEmail(_email?: string | null): boolean {
  // DEPRECATED: Admin status is now exclusively managed via Firestore /admins collection.
  // This function returns false always. Use isAdmin() from Firestore rules instead.
  return false;
}

// User-friendly translation for Firebase Authentication error codes
export function getFirebaseErrorMessage(error: any): string {
  if (!error) return 'Ha ocurrido un error inesperado.';
  const code = error.code || '';
  const message = error.message || '';

  if (code === 'auth/invalid-email' || message.includes('invalid-email')) {
    return 'El formato de correo electrónico no es válido.';
  }
  if (code === 'auth/user-not-found' || message.includes('user-not-found')) {
    return 'No existe ninguna cuenta registrada con este correo electrónico.';
  }
  if (code === 'auth/wrong-password' || message.includes('wrong-password')) {
    return 'La contraseña introducida es incorrecta.';
  }
  if (code === 'auth/invalid-credential' || message.includes('invalid-credential')) {
    return 'Credenciales inválidas. Verifica tu correo y contraseña.';
  }
  if (code === 'auth/email-already-in-use' || message.includes('email-already-in-use')) {
    return 'Este correo electrónico ya está registrado. Inicia sesión con tus datos.';
  }
  if (code === 'auth/weak-password' || message.includes('weak-password')) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }
  if (code === 'auth/popup-closed-by-user' || message.includes('popup-closed-by-user')) {
    return 'Se canceló la ventana de autenticación con Google.';
  }
  if (code === 'auth/network-request-failed' || message.includes('network-request-failed')) {
    return 'Error de conexión a internet. Verifica tu red y vuelve a intentarlo.';
  }
  if (code === 'auth/too-many-requests' || message.includes('too-many-requests')) {
    return 'Demasiados intentos fallidos. Por favor, espera unos momentos antes de reintentar.';
  }
  return error.message || 'Error en la autenticación. Inténtalo de nuevo.';
}

// Error handling mandated by Firebase Integration Skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot
export async function validateFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore notice: client is in offline mode or network check pending.');
    }
  }
}

// Sync user profile & admin documents in Firestore
export async function syncUserProfile(user: User, roleOverride?: 'admin' | 'customer'): Promise<UserProfile> {
  // Admin status is determined EXCLUSIVELY by /admins/{uid} document existence.
  // No email-based detection. No self-promotion.
  
  // Check if /admins/{uid} doc exists (only admins can create these via Firestore rules)
  let isAdminDocPresent = false;
  try {
    const adminSnap = await getDoc(doc(db, 'admins', user.uid));
    isAdminDocPresent = adminSnap.exists();
  } catch (e) {
    // Expected if not admin due to security rules
    isAdminDocPresent = false;
  }

  // Check existing /users/{uid} document if already saved
  let existingUserRole: 'admin' | 'customer' | null = null;
  let existingDisplayName: string | null = null;
  try {
    const userSnap = await getDoc(doc(db, 'users', user.uid));
    if (userSnap.exists()) {
      const data = userSnap.data();
      if (data.role === 'admin' || data.role === 'customer') {
        existingUserRole = data.role;
      }
      if (data.displayName && typeof data.displayName === 'string') {
        existingDisplayName = data.displayName;
      }
    }
  } catch (e) {
    // Ignore error if offline or permissions check
  }

  // Role resolution: Firestore /admins doc is the single source of truth for admin status.
  // roleOverride is ONLY used for initial customer creation, never for admin escalation.
  const resolvedRole: 'admin' | 'customer' = 
    (isAdminDocPresent ? 'admin' : (existingUserRole || 'customer'));

  const profile: UserProfile = {
    uid: user.uid,
    email: user.email || (user.isAnonymous ? 'anonimo@victoriosa.com' : 'usuario@victoriosa.com'),
    displayName: user.displayName || existingDisplayName || (resolvedRole === 'admin' ? 'Administrador Victoriosa' : 'Cliente Victoriosa'),
    role: resolvedRole
  };

  try {
    // Persist in /users/{uid} - only customers write their own profile; admins are managed via /admins
    await setDoc(doc(db, 'users', user.uid), {
      ...profile,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn('Could not persist profile in Firestore (offline or guest):', err);
  }

  return profile;
}

// Default Settings Initializer
export const DEFAULT_SETTINGS: AutopilotSettings = {
  autoApproveScoreThreshold: 85,
  maxRiskLevelAllowed: 'medium',
  minMarginPercentage: 45,
  autoPublishApproved: true,
  brandTone: 'luxury_lifestyle',
  activeSources: ['Amazon Global', 'AliExpress Direct', 'Trendyol Select', 'Wholesale Hub', 'Artisan Feed'],
  blacklistedKeywords: ['fake', 'replica', 'imitation', 'cure', 'medical', 'miracle', 'toxic', 'unauthorized'],
  targetCategories: ['Tecnología & Gadgets', 'Hogar & Diseño', 'Moda & Accesorios', 'Belleza & Bienestar', 'Fitness & Outdoor'],
  defaultCurrency: 'EUR (€)',
  autoDiscoveryIntervalHours: 6
};

// Ensure default settings exist
export async function ensureSettings(): Promise<AutopilotSettings> {
  try {
    const settingsDoc = await getDoc(doc(db, 'settings', 'autopilot_config'));
    if (settingsDoc.exists()) {
      return settingsDoc.data() as AutopilotSettings;
    } else {
      await setDoc(doc(db, 'settings', 'autopilot_config'), DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
  } catch (err) {
    console.warn('Error reading settings from Firestore, returning defaults:', err);
    return DEFAULT_SETTINGS;
  }
}

// Ensure default suppliers exist in Firestore
export async function ensureSuppliers(): Promise<Supplier[]> {
  try {
    const snapshot = await getDocs(collection(db, 'suppliers'));
    if (!snapshot.empty) {
      return snapshot.docs.map(d => d.data() as Supplier);
    }
    // Seed initial suppliers
    const batch = writeBatch(db);
    for (const sup of INITIAL_SUPPLIERS) {
      const docRef = doc(db, 'suppliers', sup.id);
      batch.set(docRef, sup);
    }
    await batch.commit();
    return INITIAL_SUPPLIERS;
  } catch (err) {
    console.warn('Error syncing suppliers with Firestore, using initial dataset:', err);
    return INITIAL_SUPPLIERS;
  }
}

// Upload image to Firebase Storage with robust fallback
export async function uploadImageToStorage(dataUrl: string, storagePath: string): Promise<string> {
  try {
    const imgRef = storageRef(storage, storagePath);
    // Upload base64 data URL
    await uploadString(imgRef, dataUrl, 'data_url');
    const downloadUrl = await getDownloadURL(imgRef);
    return downloadUrl;
  } catch (err) {
    console.warn('Firebase storage upload direct fallback to processed data URL:', err);
    // Return the data URL directly so image is never lost and works reliably
    return dataUrl;
  }
}

// Log audit trail event
export async function logAuditEvent(action: string, entityId: string, details: Record<string, any>, actor = 'Autopilot Core') {
  try {
    const logRef = doc(collection(db, 'audit_logs'));
    await setDoc(logRef, {
      id: logRef.id,
      timestamp: new Date().toISOString(),
      action,
      entityId,
      actor,
      details
    });
  } catch (e) {
    console.error('Failed to write audit log:', e);
  }
}
