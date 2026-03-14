'use client';

import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { fetchRatesData } from '@/lib/fetchRates';
import type { RangerRatesDoc } from '@/lib/types';

const POLL_INTERVAL_MS = 30_000;

export function useRangerRates() {
  const [rates, setRates] = useState<RangerRatesDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    if (projectId) {
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
          // Firebase error — fall back to direct protocol fetch
          fetchRatesData().then((data) => {
            setRates(data);
            setLoading(false);
          }).catch(() => setLoading(false));
        },
      );
      return unsub;
    }

    // No Firebase — fetch directly from protocol APIs
    const poll = async () => {
      try {
        const data = await fetchRatesData();
        setRates(data);
      } catch { /* silently retry next interval */ }
      setLoading(false);
    };

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, []);

  return { rates, loading };
}
