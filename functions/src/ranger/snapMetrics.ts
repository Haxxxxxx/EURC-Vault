/**
 * Ranger — snapMetrics Cloud Function
 *
 * Scheduled every 15 minutes.
 * 1. Reads latest rates from Firestore `ranger_rates/latest`
 * 2. Counts recent rebalances + compounds (last 24h from Firestore)
 * 3. Calculates blended APY based on current allocation
 * 4. Writes snapshot to `ranger_metrics` collection
 *
 * Frontend reads `ranger_metrics` ordered by timestamp for charts.
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { db } from "../lib/firestore.js";
import { REGION } from "../config.js";
import type {
  RangerRatesDoc,
  RebalancerState,
  MetricsSnapshot,
  ProtocolId,
} from "./types.js";
import { Timestamp } from "firebase-admin/firestore";

// ─── Constants ────────────────────────────────────────────────────────────────

const RATE_STALENESS_MS = 10 * 60 * 1_000;
const CIRCUIT_BREAKER_DRAWDOWN_PCT = 0.02;
const MAX_ALLOCATION_PCT = 0.70;
const MAX_UTILIZATION = 0.85;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function healthScore(
  drawdownPct: number,
  maxConcentration: number,
  utilizationWarnings: number,
): number {
  const drawdownScore = Math.max(
    0,
    100 - (drawdownPct / CIRCUIT_BREAKER_DRAWDOWN_PCT) * 50,
  );
  const concentrationOver = Math.max(0, maxConcentration - MAX_ALLOCATION_PCT);
  const concentrationScore = Math.max(
    0,
    100 - (concentrationOver / (1 - MAX_ALLOCATION_PCT)) * 30,
  );
  const utilizationScore = Math.max(0, 100 - utilizationWarnings * 20);
  return Math.round(
    drawdownScore * 0.5 + concentrationScore * 0.3 + utilizationScore * 0.2,
  );
}

async function count24hEvents(collection: string): Promise<number> {
  const cutoff = Date.now() - 24 * 60 * 60 * 1_000;
  const snap = await db
    .collection(collection)
    .where("timestamp", ">=", cutoff)
    .count()
    .get();
  return snap.data().count;
}

// ─── Scheduled Function ───────────────────────────────────────────────────────

export const rangerSnapMetrics = onSchedule(
  {
    schedule: "every 15 minutes",
    region: REGION,
    timeoutSeconds: 60,
    maxInstances: 1,
    memory: "256MiB",
  },
  async () => {
    logger.info("[snapMetrics] Starting metrics snapshot");
    const now = Date.now();

    // ── 1. Read latest rates ─────────────────────────────────────────────────
    const ratesSnap = await db.collection("ranger_rates").doc("latest").get();
    if (!ratesSnap.exists) {
      logger.warn("[snapMetrics] No rates — skipping");
      return;
    }
    const rates = ratesSnap.data() as RangerRatesDoc;
    const ratesStale = now - rates.fetchedAt > RATE_STALENESS_MS;

    // ── 2. Read bot state ────────────────────────────────────────────────────
    const stateSnap = await db
      .collection("ranger_state")
      .doc("rebalancer")
      .get();
    const state: RebalancerState = stateSnap.exists
      ? (stateSnap.data() as RebalancerState)
      : {
          lastRebalanceAt: null,
          totalRebalances: 0,
          circuitBreakerTripped: false,
          circuitBreakerTrippedAt: null,
          circuitBreakerReason: null,
          peakTvlEurc: 0,
          updatedAt: now,
        };

    // ── 3. Estimate vault state ──────────────────────────────────────────────
    // TODO: Replace with real VoltrClient.getVaultState() once vault is deployed
    const tvlEurc = state.peakTvlEurc > 0 ? state.peakTvlEurc : 100_000;
    const allocation: Record<ProtocolId, number> = {
      drift: 0.50,
      kamino: 0.30,
      save: 0.15,
    };
    const idlePct = 1 - allocation.drift - allocation.kamino - allocation.save;

    // ── 4. Blended APY (weighted average of current allocation × rates) ──────
    const blendedApy =
      allocation.drift * rates.drift.apy +
      allocation.kamino * rates.kamino.apy +
      allocation.save * rates.save.apy;

    // ── 5. Count 24h events ──────────────────────────────────────────────────
    const [rebalances24h, compounds24h] = await Promise.all([
      count24hEvents("ranger_rebalances"),
      count24hEvents("ranger_compounds"),
    ]);

    // ── 6. Health score ──────────────────────────────────────────────────────
    const maxConcentration = Math.max(...Object.values(allocation));
    const utilizationWarnings = (["drift", "kamino", "save"] as ProtocolId[])
      .filter((p) => rates[p].utilization > MAX_UTILIZATION).length;
    const peakTvl = Math.max(state.peakTvlEurc, tvlEurc);
    const drawdownPct =
      peakTvl > 0 ? Math.max(0, (peakTvl - tvlEurc) / peakTvl) : 0;

    const score = healthScore(drawdownPct, maxConcentration, utilizationWarnings);

    // ── 7. Write snapshot ────────────────────────────────────────────────────
    const snapshot: MetricsSnapshot = {
      tvlEurc,
      currentApyPct: blendedApy * 100,
      driftApyPct: rates.drift.apy * 100,
      kaminoApyPct: rates.kamino.apy * 100,
      saveApyPct: rates.save.apy * 100,
      spreadBps: rates.spreadBps,
      rebalances24h,
      compounds24h,
      healthScore: score,
      timestamp: now,
    };

    await db.collection("ranger_metrics").add(snapshot);

    // Also keep a `ranger_metrics/latest` for quick dashboard reads
    await db.collection("ranger_metrics").doc("latest").set({
      ...snapshot,
      ratesStale,
      circuitBreakerTripped: state.circuitBreakerTripped,
    });

    // Update peak TVL in state if TVL grew
    if (tvlEurc > (state.peakTvlEurc ?? 0)) {
      await db
        .collection("ranger_state")
        .doc("rebalancer")
        .set({ peakTvlEurc: tvlEurc, updatedAt: now } satisfies Partial<RebalancerState>, {
          merge: true,
        });
    }

    logger.info("[snapMetrics] Snapshot written", {
      tvlEurc,
      currentApyPct: (blendedApy * 100).toFixed(2),
      spreadBps: rates.spreadBps,
      rebalances24h,
      compounds24h,
      healthScore: score,
    });
  },
);
