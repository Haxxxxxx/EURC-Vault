'use client';

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { RangerMetrics } from '@/lib/types';

const MOCK_METRICS: RangerMetrics = {
  tvlEurc: 100_000,
  currentApyPct: 9.4,
  driftApyPct: 8.2,
  kaminoApyPct: 7.4,
  saveApyPct: 6.8,
  spreadBps: 140,
  rebalances24h: 4,
  compounds24h: 23,
  healthScore: 94,
  ratesStale: false,
  circuitBreakerTripped: false,
  timestamp: Date.now(),
};

export function useRangerMetrics() {
  const [metrics, setMetrics] = useState<RangerMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) {
      setMetrics(MOCK_METRICS);
      setLoading(false);
      return;
    }

    const ref = doc(db, 'ranger_metrics', 'latest');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setMetrics(snap.data() as RangerMetrics);
          setIsLive(true);
        } else {
          setMetrics(MOCK_METRICS);
        }
        setLoading(false);
      },
      () => {
        setMetrics(MOCK_METRICS);
        setLoading(false);
      },
    );

    return unsub;
  }, []);

  return { metrics, loading, isLive };
}
