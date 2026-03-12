'use client';

import { useCallback, useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseDb, getFirebaseFunctions, isFirebaseConfigured } from '@/lib/firebase';
import { useFirebaseAuth } from '@/hooks/useFirebaseAuth';

// ---------- Types ----------

export interface NotificationPreferences {
  epochAlerts: boolean;
  rewardDistribution: boolean;
  txConfirmations: boolean;
  securityAlerts: boolean;
}

export interface UserPreferences {
  language: string;
  currency: string;
  notifications: NotificationPreferences;
}

interface UseUserPreferencesReturn {
  preferences: UserPreferences;
  updatePreference: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => void;
  loading: boolean;
  isLive: boolean;
}

// ---------- Defaults ----------

const DEFAULT_PREFERENCES: UserPreferences = {
  language: 'en',
  currency: 'EUR',
  notifications: {
    epochAlerts: true,
    rewardDistribution: true,
    txConfirmations: false,
    securityAlerts: true,
  },
};

// ---------- Cloud Function callable ----------

function getUpdatePreferencesCallable() {
  const fns = getFirebaseFunctions();
  if (!fns) return null;
  return httpsCallable<
    { preferences: Partial<UserPreferences> },
    { success: boolean }
  >(fns, 'updatePreferences');
}

// ---------- Hook ----------

export function useUserPreferences(): UseUserPreferencesReturn {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58();
  const { isAuthenticated } = useFirebaseAuth();

  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  // Sync with Firestore when authenticated
  useEffect(() => {
    if (!isAuthenticated || !walletAddress || !isFirebaseConfigured()) {
      // Use local-only state -- defaults or whatever user has toggled this session
      setLoading(false);
      setIsLive(false);
      return;
    }

    setLoading(true);

    const fireDb = getFirebaseDb();
    if (!fireDb) return;
    const userDoc = doc(fireDb, 'users', walletAddress);

    const unsubscribe = onSnapshot(
      userDoc,
      (snapshot) => {
        if (!snapshot.exists()) {
          setLoading(false);
          setIsLive(true);
          return;
        }

        const data = snapshot.data();
        const prefs = data.preferences as Partial<UserPreferences> | undefined;

        if (prefs) {
          setPreferences({
            language: prefs.language ?? DEFAULT_PREFERENCES.language,
            currency: prefs.currency ?? DEFAULT_PREFERENCES.currency,
            notifications: {
              ...DEFAULT_PREFERENCES.notifications,
              ...prefs.notifications,
            },
          });
        }

        setIsLive(true);
        setLoading(false);
      },
      (err) => {
        console.warn('[useUserPreferences] Firestore listener error:', err);
        setIsLive(false);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [isAuthenticated, walletAddress]);

  const updatePreference = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      // Optimistic local update
      setPreferences((prev) => ({ ...prev, [key]: value }));

      // Persist to Firestore via Cloud Function when authenticated
      if (isAuthenticated && isFirebaseConfigured()) {
        const callable = getUpdatePreferencesCallable();
        callable?.({ preferences: { [key]: value } }).catch((err) => {
          console.warn('[useUserPreferences] Failed to persist preference:', err);
        });
      }
    },
    [isAuthenticated],
  );

  return { preferences, updatePreference, loading, isLive };
}
