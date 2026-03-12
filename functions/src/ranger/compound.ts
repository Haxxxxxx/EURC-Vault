/**
 * Ranger — compound Cloud Function
 *
 * Scheduled every 1 hour.
 * Checks if accrued interest ≥ compound threshold (10 EURC).
 * If yes: withdraws interest from current position and re-deposits into
 * the highest-rate protocol.
 *
 * NOTE: Actual Voltr transactions are stubbed until vault is deployed.
 *       The function still reads rates + logs decisions for auditability.
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { db } from "../lib/firestore.js";
import { REGION } from "../config.js";
import type {
  RangerRatesDoc,
  RebalancerState,
  CompoundRecord,
} from "./types.js";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum accrued interest before triggering compound (10 EURC in raw atoms) */
const COMPOUND_MIN_AMOUNT = 10 * 1_000_000; // 10 EURC
const EURC_PRECISION = 1_000_000;
const RATE_STALENESS_MS = 10 * 60 * 1_000; // 10 min

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Estimate accrued interest since last compound.
 *
 * Uses: interest ≈ deployedCapital × APY × (elapsed / 1 year)
 * This is an approximation — real amount requires querying on-chain vault state.
 *
 * TODO: Replace with actual VoltrClient.getVaultState().totalAccruedInterest
 */
function estimateAccruedInterest(
  deployedEurc: number,
  blendedApyDecimal: number,
  lastCompoundAt: number | null,
): number {
  if (lastCompoundAt === null) {
    // First compound — estimate 1 hour of interest
    const oneHour = 1 / (365.25 * 24);
    return Math.floor(deployedEurc * blendedApyDecimal * oneHour);
  }
  const elapsedYears =
    (Date.now() - lastCompoundAt) / (365.25 * 24 * 60 * 60 * 1_000);
  return Math.floor(deployedEurc * blendedApyDecimal * elapsedYears);
}

// ─── Scheduled Function ───────────────────────────────────────────────────────

export const rangerCompound = onSchedule(
  {
    schedule: "every 60 minutes",
    region: REGION,
    timeoutSeconds: 120,
    maxInstances: 1,
    memory: "256MiB",
  },
  async () => {
    logger.info("[compound] Starting compound check");
    const now = Date.now();

    // ── 1. Read latest rates ─────────────────────────────────────────────────
    const ratesSnap = await db.collection("ranger_rates").doc("latest").get();
    if (!ratesSnap.exists) {
      logger.warn("[compound] No rates available — skipping");
      return;
    }
    const rates = ratesSnap.data() as RangerRatesDoc;

    if (now - rates.fetchedAt > RATE_STALENESS_MS) {
      logger.warn("[compound] Rates stale — skipping");
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

    if (state.circuitBreakerTripped) {
      logger.warn("[compound] Circuit breaker tripped — skipping compound");
      return;
    }

    // ── 3. Estimate vault state ──────────────────────────────────────────────
    // TODO: Replace with real VoltrClient.getVaultState()
    const mockTvlEurc = state.peakTvlEurc > 0 ? state.peakTvlEurc : 100_000; // EURC
    const deployedAtoms = mockTvlEurc * EURC_PRECISION * 0.95; // 95% deployed (5% idle)

    const blendedApy =
      0.50 * rates.drift.apy + 0.30 * rates.kamino.apy + 0.15 * rates.save.apy;

    // Read last compound time
    const compoundStateSnap = await db
      .collection("ranger_state")
      .doc("compound")
      .get();
    const lastCompoundAt: number | null = compoundStateSnap.exists
      ? ((compoundStateSnap.data() as { lastCompoundAt: number | null })
          .lastCompoundAt ?? null)
      : null;

    const accruedAtoms = estimateAccruedInterest(
      deployedAtoms,
      blendedApy,
      lastCompoundAt,
    );

    logger.info("[compound] Accrued interest estimate", {
      accruedEurc: (accruedAtoms / EURC_PRECISION).toFixed(4),
      thresholdEurc: COMPOUND_MIN_AMOUNT / EURC_PRECISION,
      tvlEurc: mockTvlEurc,
      blendedApyPct: (blendedApy * 100).toFixed(2),
    });

    // ── 4. Check threshold ───────────────────────────────────────────────────
    if (accruedAtoms < COMPOUND_MIN_AMOUNT) {
      logger.info("[compound] Below threshold — skipping", {
        accruedEurc: (accruedAtoms / EURC_PRECISION).toFixed(4),
        thresholdEurc: COMPOUND_MIN_AMOUNT / EURC_PRECISION,
      });
      return;
    }

    // ── 5. Execute compound (TODO: wire up VoltrClient) ──────────────────────
    let txSig: string | undefined;
    let error: string | undefined;

    try {
      // TODO: Replace with real Voltr transaction:
      // 1. withdrawFromStrategy(currentProtocol, accruedAtoms)
      // 2. depositToStrategy(rates.best, accruedAtoms)
      logger.info("[compound] Transaction stubbed — vault not deployed", {
        amount: (accruedAtoms / EURC_PRECISION).toFixed(4),
        target: rates.best,
        apyPct: (rates[rates.best].apy * 100).toFixed(2),
      });
    } catch (err) {
      error = String(err);
      logger.error("[compound] Transaction failed", { error });
    }

    // ── 6. Log compound event ────────────────────────────────────────────────
    const record: CompoundRecord = {
      harvestedEurc: accruedAtoms / EURC_PRECISION,
      redeployedToProtocol: rates.best,
      apyAtRedeployPct: rates[rates.best].apy * 100,
      txSig,
      error,
      timestamp: now,
    };

    await db.collection("ranger_compounds").add(record);

    // ── 7. Update compound state ─────────────────────────────────────────────
    await db
      .collection("ranger_state")
      .doc("compound")
      .set({ lastCompoundAt: now, updatedAt: now }, { merge: true });

    logger.info("[compound] Compound event logged", {
      harvestedEurc: record.harvestedEurc.toFixed(4),
      target: rates.best,
    });
  },
);
