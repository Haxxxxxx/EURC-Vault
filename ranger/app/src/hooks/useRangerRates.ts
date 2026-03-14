'use client';

import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { RangerRatesDoc } from '@/lib/types';

const POLL_INTERVAL_MS = 30_000;

async function fetchRatesFromApi(): Promise<RangerRatesDoc | null> {
  try {
    const res = await fetch('/api/rates');
    if (!res.ok) return null;
    return (await res.json()) as RangerRatesDoc;
  } catch {
    return null;
  }
}

export function useRangerRates() {
  const [rates, setRates] = useState<RangerRatesDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    if (projectId) {
      // Firebase path — real-time Firestore listener
      const ref = doc(db, 'ranger_rates', 'latest');
      const unsub = onSnapshot(
        ref,
        (snap) => {
          if (snap.exists()) {
            setRates(snap.data() as RangerRatesDoc);
          }
          setLoading(false);
        },
        () => {
          // Firebase error — fall back to API
          fetchRatesFromApi().then((data) => {
            if (data) setRates(data);
            setLoading(false);
          });
        },
      );
      return unsub;
    }

    // No Firebase — poll API route for live protocol rates
    const poll = async () => {
      const data = await fetchRatesFromApi();
      if (data) setRates(data);
      setLoading(false);
    };

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, []);

  return { rates, loading };
}
