'use client';

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  onAuthStateChanged,
  signInWithCustomToken,
  signOut,
  type User,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseAuth, getFirebaseFunctions, isFirebaseConfigured } from '@/lib/firebase';

export interface FirebaseAuthContextType {
  firebaseUser: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  signIn: () => Promise<void>;
}

export const FirebaseAuthContext = createContext<FirebaseAuthContextType>({
  firebaseUser: null,
  isAuthenticated: false,
  loading: false,
  signIn: async () => {},
});

// ---------- Cloud Function callables ----------
interface NonceResponse {
  nonce: string;
}

interface VerifyResponse {
  token: string;
}

// ---------- Provider ----------
interface FirebaseAuthProviderProps {
  children: ReactNode;
}

export function FirebaseAuthProvider({ children }: FirebaseAuthProviderProps) {
  const { publicKey, signMessage, connected, disconnecting } = useWallet();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  // Track whether we've attempted auto-signin for the current wallet
  const [autoSignInAttempted, setAutoSignInAttempted] = useState<string | null>(null);

  // Listen to Firebase auth state changes.
  // Only attach the listener after a successful signIn to avoid
  // hitting Identity Toolkit endpoints before Auth is actually needed.
  // The listener is started via startAuthListener() inside signIn().
  const [authListenerStarted, setAuthListenerStarted] = useState(false);

  useEffect(() => {
    if (!authListenerStarted || !isFirebaseConfigured()) return;

    const auth = getFirebaseAuth();
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
    });

    return unsubscribe;
  }, [authListenerStarted]);

  // Sign out when wallet disconnects (only if auth was initialized)
  useEffect(() => {
    if ((disconnecting || (!connected && firebaseUser)) && authListenerStarted) {
      const auth = getFirebaseAuth();
      if (auth) {
        signOut(auth).catch(() => {
          // Silently ignore sign-out errors
        });
      }
      setAutoSignInAttempted(null);
    }
  }, [disconnecting, connected, firebaseUser, authListenerStarted]);

  /**
   * Perform the Sign-In With Solana (SIWS) flow:
   * 1. Request a nonce from the backend
   * 2. Sign a human-readable message with the wallet
   * 3. Send the signature to the backend for verification
   * 4. Receive a Firebase custom token and sign in
   */
  const signIn = useCallback(async () => {
    if (!publicKey || !signMessage || !isFirebaseConfigured()) return;
    if (loading) return;

    const auth = getFirebaseAuth();
    const functions = getFirebaseFunctions();
    if (!auth || !functions) return;

    try {
      setLoading(true);

      const requestNonce = httpsCallable<Record<string, never>, NonceResponse>(
        functions,
        'requestNonce',
      );
      const verifySignature = httpsCallable<
        { walletAddress: string; signature: string; nonce: string },
        VerifyResponse
      >(functions, 'verifySignature');

      // Step 1: Request nonce
      const { data: nonceData } = await requestNonce({});
      const { nonce } = nonceData;

      // Step 2: Sign message
      const message = new TextEncoder().encode(
        `Sign in to EURC Vault\nNonce: ${nonce}`,
      );
      const signatureBytes = await signMessage(message);

      // Step 3: Encode signature as bs58
      const { default: bs58 } = await import('bs58');
      const signatureEncoded = bs58.encode(signatureBytes);

      // Step 4: Verify signature and get custom token
      const { data: verifyData } = await verifySignature({
        walletAddress: publicKey.toBase58(),
        signature: signatureEncoded,
        nonce,
      });

      // Step 5: Sign in to Firebase
      await signInWithCustomToken(auth, verifyData.token);
      setAuthListenerStarted(true);
    } catch (err) {
      // SIWS failed -- user stays in unauthenticated state.
      // The app still works with mock/SDK data.
      console.warn('[FirebaseAuth] SIWS sign-in failed:', err);
    } finally {
      setLoading(false);
    }
  }, [publicKey, signMessage, loading]);

  // Auto-trigger SIWS when wallet connects (once per wallet)
  // Disabled during devnet testing to avoid latency from Cloud Function calls.
  // Users can trigger SIWS manually via the signIn function if needed.
  // useEffect(() => {
  //   if (!connected || !publicKey || !signMessage || !isFirebaseConfigured()) return;
  //   if (firebaseUser) return;
  //   if (loading) return;
  //   const walletAddr = publicKey.toBase58();
  //   if (autoSignInAttempted === walletAddr) return;
  //   setAutoSignInAttempted(walletAddr);
  //   signIn();
  // }, [connected, publicKey, signMessage, firebaseUser, loading, autoSignInAttempted, signIn]);

  const value = useMemo<FirebaseAuthContextType>(
    () => ({
      firebaseUser,
      isAuthenticated: firebaseUser !== null,
      loading,
      signIn,
    }),
    [firebaseUser, loading, signIn],
  );

  return (
    <FirebaseAuthContext.Provider value={value}>
      {children}
    </FirebaseAuthContext.Provider>
  );
}
