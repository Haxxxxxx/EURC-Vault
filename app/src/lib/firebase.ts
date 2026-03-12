import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Returns true if Firebase is configured with a valid project ID.
 * Used by hooks to decide between live Firestore data and mock fallbacks.
 */
export function isFirebaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
}

// Lazy singletons — only initialized when actually used (client-side)
let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _functions: Functions | null = null;

function getApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  if (!_app) {
    _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
  return _app;
}

export function getFirebaseAuth(): Auth | null {
  if (!_auth) {
    const app = getApp();
    if (!app) return null;
    _auth = getAuth(app);
  }
  return _auth;
}

export function getFirebaseDb(): Firestore | null {
  if (!_db) {
    const app = getApp();
    if (!app) return null;
    _db = getFirestore(app);
  }
  return _db;
}

export function getFirebaseFunctions(): Functions | null {
  if (!_functions) {
    const app = getApp();
    if (!app) return null;
    _functions = getFunctions(app);
  }
  return _functions;
}
