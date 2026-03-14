import { PROTOCOL_META, MAX_ALLOCATION_PCT, MIN_ALLOCATION_PCT, IDLE_RESERVE_PCT } from '@/lib/constants';
import type { ProtocolId, RangerRatesDoc } from '@/lib/types';

export interface AllocationEntry {
  id: ProtocolId | 'idle';
  label: string;
  color: string;
  pct: number; // 0-100
}

const PROTOCOLS: ProtocolId[] = ['drift', 'kamino', 'save'];

/**
 * Compute allocation from live rates using strategy params from constants.
 *
 * - If rates is null → equal split (31.67% each + IDLE_RESERVE_PCT idle)
 * - Otherwise → weight by rate proportionally, clamp to
 *   [MIN_ALLOCATION_PCT, MAX_ALLOCATION_PCT], normalise to
 *   (1 - IDLE_RESERVE_PCT), then add idle at IDLE_RESERVE_PCT.
 *
 * Returns entries sorted by pct descending.
 */
export function computeAllocation(rates: RangerRatesDoc | null): AllocationEntry[] {
  const idleReservePctInt = Math.round(IDLE_RESERVE_PCT * 100); // 5
  const activeBudget = 100 - idleReservePctInt;                 // 95

  let protocolPcts: Record<ProtocolId, number>;

  if (!rates) {
    // Equal split across protocols
    const equalPct = Math.floor(activeBudget / PROTOCOLS.length);
    const remainder = activeBudget - equalPct * PROTOCOLS.length;
    protocolPcts = {
      drift:  equalPct + (remainder > 0 ? 1 : 0),
      kamino: equalPct + (remainder > 1 ? 1 : 0),
      save:   equalPct,
    };
  } else {
    const total = PROTOCOLS.reduce((sum, id) => sum + rates[id].apy, 0);

    if (total === 0) {
      const equalPct = Math.floor(activeBudget / PROTOCOLS.length);
      const remainder = activeBudget - equalPct * PROTOCOLS.length;
      protocolPcts = {
        drift:  equalPct + (remainder > 0 ? 1 : 0),
        kamino: equalPct + (remainder > 1 ? 1 : 0),
        save:   equalPct,
      };
    } else {
      // Rate-weighted allocation
      const minPct = MIN_ALLOCATION_PCT * 100; // 10
      const maxPct = MAX_ALLOCATION_PCT * 100; // 70

      const raw: Record<ProtocolId, number> = {
        drift:  (rates.drift.apy / total) * activeBudget,
        kamino: (rates.kamino.apy / total) * activeBudget,
        save:   (rates.save.apy / total) * activeBudget,
      };

      const clamped: Record<ProtocolId, number> = {
        drift:  Math.max(minPct, Math.min(maxPct, raw.drift)),
        kamino: Math.max(minPct, Math.min(maxPct, raw.kamino)),
        save:   Math.max(minPct, Math.min(maxPct, raw.save)),
      };

      // Normalize so clamped values sum to activeBudget
      const clampedSum = clamped.drift + clamped.kamino + clamped.save;
      const scale = activeBudget / clampedSum;

      protocolPcts = {
        drift:  Math.round(clamped.drift * scale),
        kamino: Math.round(clamped.kamino * scale),
        save:   Math.round(clamped.save * scale),
      };
    }
  }

  const entries: AllocationEntry[] = PROTOCOLS.map((id) => ({
    id,
    label: PROTOCOL_META[id].label,
    color: PROTOCOL_META[id].color,
    pct: protocolPcts[id],
  }));

  // Add idle entry
  entries.push({
    id: 'idle',
    label: PROTOCOL_META.idle.label,
    color: PROTOCOL_META.idle.color,
    pct: idleReservePctInt,
  });

  // Sort descending by pct
  entries.sort((a, b) => b.pct - a.pct);

  return entries;
}
