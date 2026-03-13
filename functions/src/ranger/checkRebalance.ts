/**
 * Ranger — checkRebalance Cloud Function
 *
 * Scheduled every 15 minutes.
 * 1. Reads latest rates from Firestore `ranger_rates/latest`
 * 2. Reads bot state from `ranger_state/rebalancer`
 * 3. Evaluates whether to rebalance (spread ≥ 50 bps, cooldown elapsed, CB not tripped)
 * 4. Logs decision to `ranger_rebalances`
 * 5. Updates `ranger_state/rebalancer`
 *
 * NOTE: Actual transaction execution is stubbed until vault is deployed on-chain.
 *       Replace the TODO block with VoltrClient calls + manager keypair signing.
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { db } from "../lib/firestore.js";
import { REGION } from "../config.js";
import type {
  RangerRatesDoc,
  RebalancerState,
  RebalanceRecord,
  ProtocolId,
} from "./types.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const REBALANCE_MIN_SPREAD_BPS = 50;
const REBALANCE_COOLDOWN_MS = 30 * 60 * 1_000; // 30 min
const MAX_ALLOCATION_PCT = 0.70;
const MIN_ALLOCATION_PCT = 0.10;
const IDLE_RESERVE_PCT = 0.05;
const MAX_UTILIZATION = 0.85;
const RATE_STALENESS_MS = 10 * 60 * 1_000; // 10 min

// ─── Rebalance logic (inline — mirrors ranger/bot/engine/rebalancer.ts) ───────

interface Allocation {
  drift: number;
  kamino: number;
  save: number;
  idle: number;
}

/** Compute optimal target allocation given current rates */
function computeTargetAllocation(rates: RangerRatesDoc): Allocation {
  const protocols: ProtocolId[] = ["drift", "kamino", "save"];

  const active = protocols.filter(
    (p) => rates[p].utilization <= MAX_UTILIZATION,
  );

  if (active.length === 0) {
    return { drift: 0, kamino: 0, save: 0, idle: 1 };
  }

  const ranked = [...active].sort((a, b) => rates[b].apy - rates[a].apy);
  const best = ranked[0];

  const allocatable = 1 - IDLE_RESERVE_PCT;
  const othersMin = (ranked.length - 1) * MIN_ALLOCATION_PCT;
  const bestAlloc = Math.min(MAX_ALLOCATION_PCT, allocatable - othersMin);

  const target: Allocation = { drift: 0, kamino: 0, save: 0, idle: IDLE_RESERVE_PCT };
  target[best] = bestAlloc;
  for (const p of ranked.slice(1)) target[p] = MIN_ALLOCATION_PCT;

  return target;
}

function blendedApy(allocation: Allocation, rates: RangerRatesDoc): number {
  return (
    allocation.drift * rates.drift.apy +
    allocation.kamino * rates.kamino.apy +
    allocation.save * rates.save.apy
  );
}

// ─── Scheduled Function ───────────────────────────────────────────────────────

export const rangerCheckRebalance = onSchedule(
  {
    schedule: "every 15 minutes",
    region: REGION,
    timeoutSeconds: 120,
    maxInstances: 1,
    memory: "256MiB",
  },
  async () => {
    logger.info("[checkRebalance] Starting rebalance evaluation");
    const now = Date.now();

    // ── 1. Read latest rates ─────────────────────────────────────────────────
    const ratesSnap = await db.collection("ranger_rates").doc("latest").get();
    if (!ratesSnap.exists) {
      logger.warn("[checkRebalance] No rates in Firestore yet — skipping");
      return;
    }
    const rates = ratesSnap.data() as RangerRatesDoc;

    // Guard: stale rates
    if (now - rates.fetchedAt > RATE_STALENESS_MS) {
      logger.warn("[checkRebalance] Rates are stale — skipping rebalance");
      return;
    }

    // ── 2. Read bot state ────────────────────────────────────────────────────
    const stateRef = db.collection("ranger_state").doc("rebalancer");
    const stateSnap = await stateRef.get();
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

    // ── 3. Circuit breaker check ─────────────────────────────────────────────
    if (state.circuitBreakerTripped) {
      logger.warn("[checkRebalance] Circuit breaker tripped — rebalancing suspended", {
        reason: state.circuitBreakerReason,
        trippedAt: state.circuitBreakerTrippedAt,
      });
      return;
    }

    // ── 4. Spread check ──────────────────────────────────────────────────────
    if (rates.spreadBps < REBALANCE_MIN_SPREAD_BPS) {
      const record: RebalanceRecord = {
        decision: "SKIP",
        reason: `Spread ${rates.spreadBps} bps < minimum ${REBALANCE_MIN_SPREAD_BPS} bps`,
        spreadBps: rates.spreadBps,
        highestRateProtocol: rates.best,
        lowestRateProtocol: rates.worst,
        currentBlendedApyPct: 0,
        targetBlendedApyPct: 0,
        estimatedGainBps: 0,
        timestamp: now,
      };
      await db.collection("ranger_rebalances").add(record);
      logger.info("[checkRebalance] SKIP — spread too low", {
        spreadBps: rates.spreadBps,
      });
      return;
    }

    // ── 5. Cooldown check ────────────────────────────────────────────────────
    if (state.lastRebalanceAt !== null) {
      const msSinceLast = now - state.lastRebalanceAt;
      if (msSinceLast < REBALANCE_COOLDOWN_MS) {
        const remainingMin = Math.ceil(
          (REBALANCE_COOLDOWN_MS - msSinceLast) / 60_000,
        );
        logger.info("[checkRebalance] SKIP — cooldown active", { remainingMin });
        return;
      }
    }

    // ── 6. Compute target allocation ─────────────────────────────────────────
    // Equal-split baseline — honest for demo mode (no live vault state yet)
    const equalSplit = (1 - IDLE_RESERVE_PCT) / 3;
    const currentAlloc: Allocation = {
      drift: equalSplit,
      kamino: equalSplit,
      save: equalSplit,
      idle: IDLE_RESERVE_PCT,
    };
    const targetAlloc = computeTargetAllocation(rates);

    const currentApy = blendedApy(currentAlloc, rates);
    const targetApy = blendedApy(targetAlloc, rates);
    const estimatedGainBps = Math.round((targetApy - currentApy) * 10_000);

    // ── 7. Execute rebalance (TODO: wire up VoltrClient) ─────────────────────
    let txSig: string | undefined;
    let error: string | undefined;

    try {
      // TODO: Replace with real VoltrClient transaction:
      // const conn = new Connection(SOLANA_RPC_URL.value(), 'confirmed');
      // const managerKeypair = Keypair.fromSecretKey(bs58.decode(RANGER_MANAGER_KEYPAIR.value()));
      // const voltr = new VoltrClient(conn, managerKeypair);
      // const ix = await voltr.createWithdrawFromStrategyIx(...)
      // ... + createDepositToStrategyIx(...)
      // txSig = await sendAndConfirm(conn, [ix], [managerKeypair]);
      logger.info("[checkRebalance] Transaction stubbed — vault not yet deployed", {
        from: rates.worst,
        to: rates.best,
        spreadBps: rates.spreadBps,
        estimatedGainBps,
      });
      // Remove this line when wiring up real tx:
      txSig = undefined;
    } catch (err) {
      error = String(err);
      logger.error("[checkRebalance] Transaction failed", { error });
    }

    // ── 8. Log to Firestore ──────────────────────────────────────────────────
    const record: RebalanceRecord = {
      decision: "REBALANCE",
      reason: `Spread ${rates.spreadBps} bps ≥ threshold — routing to ${rates.best}`,
      spreadBps: rates.spreadBps,
      highestRateProtocol: rates.best,
      lowestRateProtocol: rates.worst,
      currentBlendedApyPct: currentApy * 100,
      targetBlendedApyPct: targetApy * 100,
      estimatedGainBps,
      txSig,
      error,
      timestamp: now,
    };

    await db.collection("ranger_rebalances").add(record);

    // ── 9. Update bot state ──────────────────────────────────────────────────
    await stateRef.set(
      {
        lastRebalanceAt: now,
        totalRebalances: (state.totalRebalances ?? 0) + 1,
        updatedAt: now,
      } satisfies Partial<RebalancerState>,
      { merge: true },
    );

    logger.info("[checkRebalance] REBALANCE decision logged", {
      from: rates.worst,
      to: rates.best,
      spreadBps: rates.spreadBps,
      currentApyPct: (currentApy * 100).toFixed(2),
      targetApyPct: (targetApy * 100).toFixed(2),
      estimatedGainBps,
    });
  },
);
