'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { RebalanceRecord } from '@/lib/types';

const MOCK_HISTORY: RebalanceRecord[] = [
  {
    decision: 'REBALANCE',
    reason: 'Spread 140 bps ≥ threshold — routing to drift',
    spreadBps: 140,
    highestRateProtocol: 'drift',
    lowestRateProtocol: 'save',
    currentBlendedApyPct: 7.4,
    targetBlendedApyPct: 8.1,
    estimatedGainBps: 70,
    txSig: undefined,
    timestamp: Date.now() - 25 * 60 * 1000,
  },
  {
    decision: 'SKIP',
    reason: 'Spread 38 bps < minimum 50 bps',
    spreadBps: 38,
    highestRateProtocol: 'drift',
    lowestRateProtocol: 'save',
    currentBlendedApyPct: 7.8,
    targetBlendedApyPct: 7.8,
    estimatedGainBps: 0,
    timestamp: Date.now() - 65 * 60 * 1000,
  },
  {
    decision: 'REBALANCE',
    reason: 'Spread 210 bps ≥ threshold — routing to kamino',
    spreadBps: 210,
    highestRateProtocol: 'kamino',
    lowestRateProtocol: 'save',
    currentBlendedApyPct: 7.1,
    targetBlendedApyPct: 8.6,
    estimatedGainBps: 150,
    timestamp: Date.now() - 2 * 60 * 60 * 1000,
  },
];

export function useRebalanceHistory(maxItems = 20) {
  const [history, setHistory] = useState<RebalanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) {
      setHistory(MOCK_HISTORY);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'ranger_rebalances'),
      orderBy('timestamp', 'desc'),
      limit(maxItems),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const records = snap.docs.map((d) => d.data() as RebalanceRecord);
        setHistory(records.length > 0 ? records : MOCK_HISTORY);
        setIsLive(records.length > 0);
        setLoading(false);
      },
      () => {
        setHistory(MOCK_HISTORY);
        setLoading(false);
      },
    );

    return unsub;
  }, [maxItems]);

  return { history, loading, isLive };
}
