'use client';

import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { fetchRatesData } from '@/lib/fetchRates';
import { computeMetrics } from '@/lib/computeMetrics';
import type { RangerMetrics } from '@/lib/types';

const POLL_INTERVAL_MS = 30_000;

export function useRangerMetrics() {
  const [metrics, setMetrics] = useState<RangerMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    if (projectId) {
      const ref = doc(db, 'ranger_metrics', 'latest');
      const unsub = onSnapshot(
        ref,
        (snap) => {
          if (snap.exists()) {
            setMetrics(snap.data() as RangerMetrics);
          }
          setLoading(false);
        },
        () => {
          // Firebase error — compute from live rates
          fetchRatesData().then((rates) => {
            setMetrics(computeMetrics(rates));
            setLoading(false);
          }).catch(() => setLoading(false));
        },
      );
      return unsub;
    }

    // No Firebase — compute from live protocol rates
    const poll = async () => {
      try {
        const rates = await fetchRatesData();
        setMetrics(computeMetrics(rates));
      } catch { /* silently retry next interval */ }
      setLoading(false);
    };

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, []);

  return { metrics, loading };
}
