'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface MetricsPoint {
  timestamp: number;
  currentApyPct: number;
  driftApyPct: number;
  kaminoApyPct: number;
  saveApyPct: number;
  tvlEurc: number;
  spreadBps: number;
}

// ─── Mock data generator ──────────────────────────────────────────────────────
// 7 days × 96 points/day (every 15 min) = 672 points

function generateMockHistory(): MetricsPoint[] {
  const now = Date.now();
  const intervalMs = 15 * 60 * 1_000; // 15 min
  const points: MetricsPoint[] = [];

  let driftApy = 8.2;
  let kaminoApy = 7.4;
  let saveApy = 6.8;
  let tvl = 100_000;

  for (let i = 672; i >= 0; i--) {
    const timestamp = now - i * intervalMs;

    // Apply small random walk to APYs (within realistic bounds)
    driftApy  = Math.max(4, Math.min(14, driftApy  + (Math.random() - 0.5) * 0.3));
    kaminoApy = Math.max(3, Math.min(13, kaminoApy + (Math.random() - 0.5) * 0.25));
    saveApy   = Math.max(3, Math.min(11, saveApy   + (Math.random() - 0.5) * 0.2));

    // Simulate occasional rate spikes (protocol incentive events)
    if (Math.random() < 0.005) driftApy  += Math.random() * 4;
    if (Math.random() < 0.005) kaminoApy += Math.random() * 3;
    if (Math.random() < 0.005) saveApy   += Math.random() * 2.5;

    // Clamp after spikes
    driftApy  = Math.min(14, driftApy);
    kaminoApy = Math.min(13, kaminoApy);
    saveApy   = Math.min(11, saveApy);

    // TVL grows slowly (compounding + new deposits simulation)
    tvl = tvl * (1 + driftApy / 100 / (365 * 96));
    tvl += Math.random() < 0.01 ? Math.random() * 5000 : 0; // occasional new deposits

    // Blended APY: 50% drift, 30% kamino, 15% save, 5% idle (0%)
    const blended = 0.50 * driftApy + 0.30 * kaminoApy + 0.15 * saveApy;
    const spread = Math.round((Math.max(driftApy, kaminoApy, saveApy) - Math.min(driftApy, kaminoApy, saveApy)) * 100);

    points.push({
      timestamp,
      currentApyPct: parseFloat(blended.toFixed(2)),
      driftApyPct:   parseFloat(driftApy.toFixed(2)),
      kaminoApyPct:  parseFloat(kaminoApy.toFixed(2)),
      saveApyPct:    parseFloat(saveApy.toFixed(2)),
      tvlEurc:       parseFloat(tvl.toFixed(2)),
      spreadBps:     spread,
    });
  }

  return points;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMetricsHistory(days = 7) {
  const [history, setHistory] = useState<MetricsPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) {
      setHistory(generateMockHistory());
      setLoading(false);
      return;
    }

    // 7 days × 96 points = 672 max
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
          .sort((a, b) => a.timestamp - b.timestamp); // ascending for charts

        if (raw.length >= 10) {
          setHistory(raw);
          setIsLive(true);
        } else {
          setHistory(generateMockHistory());
          setIsLive(false);
        }
        setLoading(false);
      },
      () => {
        setHistory(generateMockHistory());
        setLoading(false);
      },
    );

    return unsub;
  }, [days]);

  return { history, loading, isLive };
}
