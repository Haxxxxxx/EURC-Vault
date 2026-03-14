/**
 * Live data utilities — generate realistic historical data
 * based on real-time protocol rates for chart rendering.
 *
 * Used when Firebase is not configured to provide plausible
 * time-series data for analytics charts and activity feeds.
 */

import type { ProtocolId, RangerRatesDoc, RebalanceRecord, ActivityEvent } from './types';
import type { MetricsPoint } from '@/hooks/useMetricsHistory';
import { PROTOCOL_META } from './constants';

// ─── Seeded random for deterministic output per rate snapshot ────────────────
// Seed is derived from rates so the same rates always produce the same data.
// Resets when rates change (new API fetch), but stable within a session.

let seed = 42;

export function initSeed(rates: RangerRatesDoc) {
  seed = (
    Math.round(rates.drift.apy * 100_000) +
    Math.round(rates.kamino.apy * 100_000) * 3 +
    Math.round(rates.save.apy * 100_000) * 7 +
    73856 // salt
  ) % 2147483647 || 42;
}

function seededRandom(): number {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

function jitter(base: number, range: number): number {
  return base + (seededRandom() - 0.5) * 2 * range;
}

// ─── Metrics History Generator ──────────────────────────────────────────────

export function generateMetricsHistory(
  days: number,
  currentRates: RangerRatesDoc,
): MetricsPoint[] {
  initSeed(currentRates);
  const now = Date.now();
  const intervalMs = 15 * 60 * 1_000;
  const totalPoints = days * 96;
  const points: MetricsPoint[] = [];

  // Start from current real rates and walk backwards with small jitter
  let driftApy = currentRates.drift.apy * 100;
  let kaminoApy = currentRates.kamino.apy * 100;
  let saveApy = currentRates.save.apy * 100;
  let tvl = 125_000; // Starting TVL grows over the period

  for (let i = totalPoints; i >= 0; i--) {
    const timestamp = now - i * intervalMs;

    // Random walk APYs with mean reversion toward current rates
    const meanRevert = 0.02; // pull toward real current rate
    driftApy += (seededRandom() - 0.5) * 0.4 + (currentRates.drift.apy * 100 - driftApy) * meanRevert;
    kaminoApy += (seededRandom() - 0.5) * 0.35 + (currentRates.kamino.apy * 100 - kaminoApy) * meanRevert;
    saveApy += (seededRandom() - 0.5) * 0.3 + (currentRates.save.apy * 100 - saveApy) * meanRevert;

    // Clamp to reasonable bounds
    driftApy = Math.max(2, Math.min(18, driftApy));
    kaminoApy = Math.max(1.5, Math.min(16, kaminoApy));
    saveApy = Math.max(1, Math.min(14, saveApy));

    // TVL grows (compound interest + occasional deposits)
    const blendedRate = 0.50 * driftApy + 0.30 * kaminoApy + 0.15 * saveApy;
    tvl = tvl * (1 + blendedRate / 100 / (365 * 96));
    if (seededRandom() < 0.008) tvl += seededRandom() * 10_000; // new deposit

    const spread = Math.round(
      (Math.max(driftApy, kaminoApy, saveApy) - Math.min(driftApy, kaminoApy, saveApy)) * 100,
    );

    points.push({
      timestamp,
      currentApyPct: parseFloat(blendedRate.toFixed(2)),
      driftApyPct: parseFloat(driftApy.toFixed(2)),
      kaminoApyPct: parseFloat(kaminoApy.toFixed(2)),
      saveApyPct: parseFloat(saveApy.toFixed(2)),
      tvlEurc: parseFloat(tvl.toFixed(2)),
      spreadBps: spread,
    });
  }

  return points;
}

// ─── Rebalance Records Generator ────────────────────────────────────────────

export function generateRebalanceRecords(
  count: number,
  currentRates: RangerRatesDoc,
): RebalanceRecord[] {
  initSeed(currentRates);
  const now = Date.now();
  const records: RebalanceRecord[] = [];
  const protocols: ProtocolId[] = ['drift', 'kamino', 'save'];

  for (let i = 0; i < count; i++) {
    const timestamp = now - (i * 3600_000 * (1 + seededRandom() * 2)); // 1-3h apart
    const isRebalance = seededRandom() > 0.35;

    const high = protocols[Math.floor(seededRandom() * 3)];
    let low = protocols[Math.floor(seededRandom() * 3)];
    while (low === high) low = protocols[Math.floor(seededRandom() * 3)];

    const spread = isRebalance
      ? 50 + Math.floor(seededRandom() * 250)
      : 10 + Math.floor(seededRandom() * 40);

    const baseApy = currentRates[high].apy * 100;

    records.push({
      decision: isRebalance ? 'REBALANCE' : 'SKIP',
      reason: isRebalance
        ? `Spread ${spread} bps >= threshold — routing to ${PROTOCOL_META[high].label}`
        : `Spread ${spread} bps < minimum 50 bps`,
      spreadBps: spread,
      highestRateProtocol: high,
      lowestRateProtocol: low,
      currentBlendedApyPct: parseFloat(jitter(baseApy - 1, 0.5).toFixed(2)),
      targetBlendedApyPct: parseFloat(jitter(baseApy, 0.3).toFixed(2)),
      estimatedGainBps: isRebalance ? Math.floor(spread * 0.4) : 0,
      timestamp,
    });
  }

  return records.sort((a, b) => b.timestamp - a.timestamp);
}

// ─── Activity Events Generator ──────────────────────────────────────────────

export function generateActivityEvents(count: number): ActivityEvent[] {
  const now = Date.now();
  const events: ActivityEvent[] = [];
  const protocols: ProtocolId[] = ['drift', 'kamino', 'save'];

  const templates = [
    // Rebalance
    () => {
      const from = protocols[Math.floor(seededRandom() * 3)];
      let to = protocols[Math.floor(seededRandom() * 3)];
      while (to === from) to = protocols[Math.floor(seededRandom() * 3)];
      const spread = 50 + Math.floor(seededRandom() * 200);
      const amount = parseFloat(jitter(25_000, 15_000).toFixed(2));
      return {
        type: 'rebalance' as const,
        title: `Rebalanced ${PROTOCOL_META[from].label} → ${PROTOCOL_META[to].label}`,
        description: `Moved €${amount.toLocaleString()} to capture ${spread} bps rate spread.`,
        protocol: to,
        amountEurc: amount,
        gainBps: Math.floor(spread * 0.4),
      };
    },
    // Compound
    () => {
      const protocol = protocols[Math.floor(seededRandom() * 3)];
      const amount = parseFloat(jitter(42, 30).toFixed(2));
      return {
        type: 'compound' as const,
        title: `Auto-compounded ${PROTOCOL_META[protocol].label} yield`,
        description: `Reinvested €${amount.toFixed(2)} of accrued interest back into the vault.`,
        protocol,
        amountEurc: amount,
      };
    },
    // Rate alert
    () => {
      const protocol = protocols[Math.floor(seededRandom() * 3)];
      const apy = jitter(9, 3);
      const direction = seededRandom() > 0.3 ? 'spiked' : 'dropped';
      return {
        type: 'rate_alert' as const,
        title: `${PROTOCOL_META[protocol].label} APY ${direction} to ${apy.toFixed(1)}%`,
        description: direction === 'spiked'
          ? 'Rate increase detected — evaluating rebalance to capture higher yield.'
          : 'Rate decrease detected — monitoring for sustained drop before reducing allocation.',
        protocol,
      };
    },
    // Health check
    () => {
      const score = 85 + Math.floor(seededRandom() * 13);
      return {
        type: 'health_check' as const,
        title: `Health check passed — score ${score}/100`,
        description: 'All protocols within concentration limits. Circuit breaker: inactive.',
      };
    },
  ];

  // Weighted selection: more rebalances/compounds
  const weights = [4, 3, 2, 1];
  const weighted = templates.flatMap((t, i) => Array(weights[i]).fill(t));

  for (let i = 0; i < count; i++) {
    const template = weighted[Math.floor(seededRandom() * weighted.length)] as () => Partial<ActivityEvent>;
    const event = template();
    events.push({
      id: `evt_${i}`,
      type: event.type!,
      title: event.title!,
      description: event.description!,
      protocol: event.protocol,
      amountEurc: event.amountEurc,
      gainBps: event.gainBps,
      timestamp: now - Math.floor(seededRandom() * 6 * 3600_000),
    });
  }

  return events.sort((a, b) => b.timestamp - a.timestamp);
}
