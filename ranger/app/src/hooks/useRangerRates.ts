'use client';

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { RangerRatesDoc } from '@/lib/types';

// Mock data for when Firebase isn't configured
const MOCK_RATES: RangerRatesDoc = {
  drift:  { protocol: 'drift',  apy: 0.082, apyBps: 820, utilization: 0.71, isStale: false, fetchedAt: Date.now() },
  kamino: { protocol: 'kamino', apy: 0.074, apyBps: 740, utilization: 0.65, isStale: false, fetchedAt: Date.now() },
  save:   { protocol: 'save',   apy: 0.068, apyBps: 680, utilization: 0.58, isStale: false, fetchedAt: Date.now() },
  best: 'drift',
  worst: 'save',
  spreadBps: 140,
  fetchedAt: Date.now(),
};

export function useRangerRates() {
  const [rates, setRates] = useState<RangerRatesDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) {
      // No Firebase configured — use mock data
      setRates(MOCK_RATES);
      setLoading(false);
      setIsLive(false);
      return;
    }

    const ref = doc(db, 'ranger_rates', 'latest');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setRates(snap.data() as RangerRatesDoc);
          setIsLive(true);
        } else {
          setRates(MOCK_RATES);
          setIsLive(false);
        }
        setLoading(false);
      },
      () => {
        setRates(MOCK_RATES);
        setLoading(false);
        setIsLive(false);
      },
    );

    return unsub;
  }, []);

  return { rates, loading, isLive };
}
