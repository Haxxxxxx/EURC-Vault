'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { fetchRatesData } from '@/lib/fetchRates';
import { generateRebalanceRecords } from '@/lib/liveData';
import type { RangerRatesDoc, RebalanceRecord } from '@/lib/types';

export function useRebalanceHistory(maxItems = 20) {
  const [history, setHistory] = useState<RebalanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    if (projectId) {
      const q = query(
        collection(db, 'ranger_rebalances'),
        orderBy('timestamp', 'desc'),
        limit(maxItems),
      );

      const unsub = onSnapshot(
        q,
        (snap) => {
          const records = snap.docs.map((d) => d.data() as RebalanceRecord);
          setHistory(records);
          setLoading(false);
        },
        () => {
          setLoading(false);
        },
      );
      return unsub;
    }

    // No Firebase — generate from live protocol rates
    fetchRatesData()
      .then((rates: RangerRatesDoc) => {
        setHistory(generateRebalanceRecords(maxItems, rates));
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [maxItems]);

  return { history, loading };
}
