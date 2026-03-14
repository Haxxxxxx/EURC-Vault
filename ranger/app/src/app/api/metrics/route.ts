import { NextResponse } from 'next/server';
import type { RangerMetrics, RangerRatesDoc } from '@/lib/types';
import { fetchRatesData } from '@/lib/fetchRates';

// ─── In-memory cache (60s TTL) ──────────────────────────────────────────────

let cachedMetrics: RangerMetrics | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

// ─── Health score computation (mirrors functions/src/ranger/snapMetrics.ts) ─

function computeHealthScore(rates: RangerRatesDoc): number {
  let score = 100;

  const staleCount = (['drift', 'kamino', 'save'] as const).filter((p) => rates[p].isStale).length;
  score -= staleCount * 10;

  for (const p of ['drift', 'kamino', 'save'] as const) {
    if (rates[p].utilization > 0.85) score -= 15;
    else if (rates[p].utilization > 0.70) score -= 5;
  }

  if (rates.spreadBps >= 50) score = Math.min(100, score + 5);

  return Math.max(0, Math.min(100, score));
}

// ─── Route Handler ──────────────────────────────────────────────────────────

export async function GET() {
  if (cachedMetrics && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return NextResponse.json(cachedMetrics, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, max-age=60' },
    });
  }

  try {
    // Direct function call — no HTTP round-trip, no SSRF risk
    const rates = await fetchRatesData();

    const blendedApy =
      0.50 * rates.drift.apy +
      0.30 * rates.kamino.apy +
      0.15 * rates.save.apy +
      0.05 * 0; // 5% idle reserve earns nothing

    const metrics: RangerMetrics = {
      tvlEurc: 0,
      currentApyPct: parseFloat((blendedApy * 100).toFixed(2)),
      driftApyPct: parseFloat((rates.drift.apy * 100).toFixed(2)),
      kaminoApyPct: parseFloat((rates.kamino.apy * 100).toFixed(2)),
      saveApyPct: parseFloat((rates.save.apy * 100).toFixed(2)),
      spreadBps: rates.spreadBps,
      rebalances24h: 0,
      compounds24h: 0,
      healthScore: computeHealthScore(rates),
      ratesStale: (['drift', 'kamino', 'save'] as const).some((p) => rates[p].isStale),
      circuitBreakerTripped: false,
      timestamp: Date.now(),
    };

    cachedMetrics = metrics;
    cacheTimestamp = Date.now();

    return NextResponse.json(metrics, {
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, max-age=60' },
    });
  } catch (err) {
    console.error(`[api/metrics] Failed: ${err instanceof Error ? err.message : 'unknown'}`);
    return NextResponse.json({ error: 'Failed to compute metrics' }, { status: 500 });
  }
}
