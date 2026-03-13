'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { RebalanceRecord } from '@/lib/types';

function generateMockHistory(): RebalanceRecord[] {
  const now = Date.now();
  return [
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
      timestamp: now - 12 * 60 * 1000,
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
      timestamp: now - 27 * 60 * 1000,
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
      timestamp: now - 52 * 60 * 1000,
    },
    {
      decision: 'SKIP',
      reason: 'Spread 42 bps < minimum 50 bps',
      spreadBps: 42,
      highestRateProtocol: 'kamino',
      lowestRateProtocol: 'save',
      currentBlendedApyPct: 8.2,
      targetBlendedApyPct: 8.2,
      estimatedGainBps: 0,
      timestamp: now - 67 * 60 * 1000,
    },
    {
      decision: 'REBALANCE',
      reason: 'Spread 95 bps ≥ threshold — routing to drift',
      spreadBps: 95,
      highestRateProtocol: 'drift',
      lowestRateProtocol: 'kamino',
      currentBlendedApyPct: 7.6,
      targetBlendedApyPct: 8.3,
      estimatedGainBps: 65,
      timestamp: now - 95 * 60 * 1000,
    },
    {
      decision: 'REBALANCE',
      reason: 'Spread 180 bps ≥ threshold — routing to save',
      spreadBps: 180,
      highestRateProtocol: 'save',
      lowestRateProtocol: 'drift',
      currentBlendedApyPct: 7.0,
      targetBlendedApyPct: 8.4,
      estimatedGainBps: 140,
      timestamp: now - 2.5 * 60 * 60 * 1000,
    },
  ];
}

export function useRebalanceHistory(maxItems = 20) {
  const [history, setHistory] = useState<RebalanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) {
      setHistory(generateMockHistory());
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
        setHistory(records.length > 0 ? records : generateMockHistory());
        setIsLive(records.length > 0);
        setLoading(false);
      },
      () => {
        setHistory(generateMockHistory());
        setLoading(false);
      },
    );

    return unsub;
  }, [maxItems]);

  return { history, loading, isLive };
}
