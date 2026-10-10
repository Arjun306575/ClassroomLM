import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from 'firebase/app-check';
import rawFirebaseConfig from '../../firebase-applet-config.json';

// Helper to resolve an environment variable dynamically across client (Vite import.meta.env) and Node (process.env)
const resolveEnv = (viteKey: string, nodeKey: string, fallbackVal?: string): string => {
  // Check Vite client-side environment (import.meta.env)
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
  if (metaEnv) {
    if (metaEnv[viteKey]) return metaEnv[viteKey];
    if (metaEnv[nodeKey]) return metaEnv[nodeKey];
  }
  // Check Node.js / SSR environment (process.env)
  if (typeof process !== 'undefined' && process.env) {
    if (process.env[nodeKey]) return process.env[nodeKey];
    if (process.env[viteKey]) return process.env[viteKey];
  }
  // If the raw config value is NOT an unparsed expression or placeholder, return it
  if (fallbackVal && !fallbackVal.includes('process.env') && !fallbackVal.includes('import.meta.env') && !fallbackVal.startsWith('${')) {
    return fallbackVal;
  }
  return '';
};

// Dynamically resolved Firebase configuration loaded from environment variables
export const firebaseConfig: FirebaseOptions & {
  firestoreDatabaseId?: string;
  oAuthClientId?: string;
  recaptchaSiteKey?: string;
} = {
  apiKey: resolveEnv('VITE_FIREBASE_API_KEY', 'FIREBASE_API_KEY', rawFirebaseConfig?.apiKey),
  authDomain: resolveEnv('VITE_FIREBASE_AUTH_DOMAIN', 'FIREBASE_AUTH_DOMAIN', rawFirebaseConfig?.authDomain),
  projectId: resolveEnv('VITE_FIREBASE_PROJECT_ID', 'FIREBASE_PROJECT_ID', rawFirebaseConfig?.projectId),
  storageBucket: resolveEnv('VITE_FIREBASE_STORAGE_BUCKET', 'FIREBASE_STORAGE_BUCKET', rawFirebaseConfig?.storageBucket),
  messagingSenderId: resolveEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_MESSAGING_SENDER_ID', rawFirebaseConfig?.messagingSenderId),
  appId: resolveEnv('VITE_FIREBASE_APP_ID', 'FIREBASE_APP_ID', rawFirebaseConfig?.appId),
  measurementId: resolveEnv('VITE_FIREBASE_MEASUREMENT_ID', 'FIREBASE_MEASUREMENT_ID', rawFirebaseConfig?.measurementId),
  firestoreDatabaseId: resolveEnv('VITE_FIREBASE_FIRESTORE_DATABASE_ID', 'FIREBASE_FIRESTORE_DATABASE_ID', rawFirebaseConfig?.firestoreDatabaseId),
  oAuthClientId: resolveEnv('VITE_FIREBASE_OAUTH_CLIENT_ID', 'FIREBASE_OAUTH_CLIENT_ID', rawFirebaseConfig?.oAuthClientId),
  recaptchaSiteKey:
    resolveEnv('VITE_RECAPTCHA_SITE_KEY', 'RECAPTCHA_SITE_KEY') ||
    resolveEnv('VITE_FIREBASE_RECAPTCHA_SITE_KEY', 'FIREBASE_RECAPTCHA_SITE_KEY', rawFirebaseConfig?.recaptchaSiteKey),
};

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize App Check with reCAPTCHA v3 provider if site key is configured
let appCheckInstance: AppCheck | null = null;
if (typeof window !== 'undefined' && firebaseConfig.recaptchaSiteKey) {
  try {
    appCheckInstance = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(firebaseConfig.recaptchaSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    // Non-fatal if domain not whitelisted in reCAPTCHA console during preview
    console.info('[reCAPTCHA / AppCheck] Initialized or status note:', err);
  }
}
export const appCheck = appCheckInstance;

// Initialize Firestore with database ID specified in config (CRITICAL requirement)
// Use long-polling transport in browser to prevent WebChannel stream failures in iframes/sandboxes
const databaseId = firebaseConfig.firestoreDatabaseId || undefined;
let firestoreDb: ReturnType<typeof getFirestore>;
try {
  firestoreDb = initializeFirestore(
    app,
    typeof window !== 'undefined'
      ? {
          experimentalForceLongPolling: true,
        }
      : {},
    databaseId
  );
} catch {
  firestoreDb = getFirestore(app, databaseId);
}

export const db = firestoreDb;

// Initialize Firebase Auth
export const auth = getAuth(app);

// Google Auth Provider
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({
  prompt: 'select_account'
});

export const FIREBASE_APP_CONFIG = firebaseConfig;

// SKILL REQUIREMENT: Validate Connection to Firestore on boot
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('the client is offline') || msg.includes('unavailable') || error?.code === 'unavailable') {
      console.warn("Firestore operates in offline/cached mode until backend connection is established.");
    }
  }
}

testConnection();

// SKILL REQUIREMENT: Error logging and handling conforming to FirestoreErrorInfo
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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
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
