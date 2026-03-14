'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { generateMetricsHistory } from '@/lib/liveData';
import type { RangerRatesDoc } from '@/lib/types';

export interface MetricsPoint {
  timestamp: number;
  currentApyPct: number;
  driftApyPct: number;
  kaminoApyPct: number;
  saveApyPct: number;
  tvlEurc: number;
  spreadBps: number;
}

export function useMetricsHistory(days = 7) {
  const [history, setHistory] = useState<MetricsPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    if (projectId) {
      const maxPoints = days * 96;
      const q = query(
        collection(db, 'ranger_metrics'),
        orderBy('timestamp', 'desc'),
        limit(maxPoints),
      );

      const unsub = onSnapshot(
        q,
        (snap) => {
          const raw = snap.docs
            .map((d) => d.data() as MetricsPoint)
            .filter((p) => typeof p.timestamp === 'number')
            .sort((a, b) => a.timestamp - b.timestamp);
          setHistory(raw);
          setLoading(false);
        },
        () => {
          setLoading(false);
        },
      );
      return unsub;
    }

    // No Firebase — generate history from live API rates
    fetch('/api/rates')
      .then((res) => {
        if (!res.ok) throw new Error(`API ${res.status}`);
        return res.json();
      })
      .then((rates: RangerRatesDoc) => {
        setHistory(generateMetricsHistory(days, rates));
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [days]);

  return { history, loading };
}
