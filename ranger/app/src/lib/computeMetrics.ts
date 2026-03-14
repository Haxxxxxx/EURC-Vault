import type { RangerMetrics, RangerRatesDoc } from './types';

/** Compute metrics from rates — works client-side without API route */
export function computeMetrics(rates: RangerRatesDoc): RangerMetrics {
  const blendedApy =
    0.50 * rates.drift.apy +
    0.30 * rates.kamino.apy +
    0.15 * rates.save.apy;

  let healthScore = 100;
  const staleCount = (['drift', 'kamino', 'save'] as const).filter((p) => rates[p].isStale).length;
  healthScore -= staleCount * 10;
  for (const p of ['drift', 'kamino', 'save'] as const) {
    if (rates[p].utilization > 0.85) healthScore -= 15;
    else if (rates[p].utilization > 0.70) healthScore -= 5;
  }
  if (rates.spreadBps >= 50) healthScore = Math.min(100, healthScore + 5);
  healthScore = Math.max(0, Math.min(100, healthScore));

  return {
    tvlEurc: 0,
    currentApyPct: parseFloat((blendedApy * 100).toFixed(2)),
    driftApyPct: parseFloat((rates.drift.apy * 100).toFixed(2)),
    kaminoApyPct: parseFloat((rates.kamino.apy * 100).toFixed(2)),
    saveApyPct: parseFloat((rates.save.apy * 100).toFixed(2)),
    spreadBps: rates.spreadBps,
    rebalances24h: 0,
    compounds24h: 0,
    healthScore,
    ratesStale: (['drift', 'kamino', 'save'] as const).some((p) => rates[p].isStale),
    circuitBreakerTripped: false,
    timestamp: Date.now(),
  };
}
