'use client';

import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { RangerRatesDoc, ProtocolId } from '@/lib/types';

// Base mock rates — jittered every 30s to simulate live data
const BASE_RATES = {
  drift:  { apy: 0.082, utilization: 0.71 },
  kamino: { apy: 0.074, utilization: 0.65 },
  save:   { apy: 0.068, utilization: 0.58 },
} as const;

/** Adds realistic jitter (±0.3%) to a rate */
function jitter(base: number, range = 0.003): number {
  return Math.max(0.01, base + (Math.random() - 0.5) * 2 * range);
}

function generateMockRates(): RangerRatesDoc {
  const drift  = jitter(BASE_RATES.drift.apy);
  const kamino = jitter(BASE_RATES.kamino.apy);
  const save   = jitter(BASE_RATES.save.apy);

  const rates = { drift, kamino, save };
  const best  = (Object.entries(rates) as [ProtocolId, number][]).sort((a, b) => b[1] - a[1])[0][0];
  const worst = (Object.entries(rates) as [ProtocolId, number][]).sort((a, b) => a[1] - b[1])[0][0];

  return {
    drift:  { protocol: 'drift',  apy: drift,  apyBps: Math.round(drift * 10_000),  utilization: jitter(BASE_RATES.drift.utilization, 0.02),  isStale: false, fetchedAt: Date.now() },
    kamino: { protocol: 'kamino', apy: kamino, apyBps: Math.round(kamino * 10_000), utilization: jitter(BASE_RATES.kamino.utilization, 0.02), isStale: false, fetchedAt: Date.now() },
    save:   { protocol: 'save',   apy: save,   apyBps: Math.round(save * 10_000),   utilization: jitter(BASE_RATES.save.utilization, 0.02),   isStale: false, fetchedAt: Date.now() },
    best,
    worst,
    spreadBps: Math.round((rates[best] - rates[worst]) * 10_000),
    fetchedAt: Date.now(),
  };
}

export function useRangerRates() {
  const [rates, setRates] = useState<RangerRatesDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  const refreshMock = useCallback(() => {
    setRates(generateMockRates());
  }, []);

  useEffect(() => {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) {
      // No Firebase configured — use mock data with periodic jitter
      setRates(generateMockRates());
      setLoading(false);
      setIsLive(false);

      // Refresh mock rates every 30s to simulate live updates
      const interval = setInterval(refreshMock, 30_000);
      return () => clearInterval(interval);
    }

    const ref = doc(db, 'ranger_rates', 'latest');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setRates(snap.data() as RangerRatesDoc);
          setIsLive(true);
        } else {
          setRates(generateMockRates());
          setIsLive(false);
        }
        setLoading(false);
      },
      () => {
        setRates(generateMockRates());
        setLoading(false);
        setIsLive(false);
      },
    );

    return unsub;
  }, [refreshMock]);

  return { rates, loading, isLive };
}
