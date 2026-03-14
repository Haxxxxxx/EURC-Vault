'use client';

import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { RangerMetrics } from '@/lib/types';

const POLL_INTERVAL_MS = 30_000;

async function fetchMetricsFromApi(): Promise<RangerMetrics | null> {
  try {
    const res = await fetch('/api/metrics');
    if (!res.ok) return null;
    return (await res.json()) as RangerMetrics;
  } catch {
    return null;
  }
}

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
          fetchMetricsFromApi().then((data) => {
            if (data) setMetrics(data);
            setLoading(false);
          });
        },
      );
      return unsub;
    }

    const poll = async () => {
      const data = await fetchMetricsFromApi();
      if (data) setMetrics(data);
      setLoading(false);
    };

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, []);

  return { metrics, loading };
}
