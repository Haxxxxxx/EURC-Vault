/**
 * Ranger — healthCheck Cloud Function
 *
 * Scheduled every 5 minutes.
 * 1. Reads latest rates from Firestore
 * 2. Calculates vault health score and risk level
 * 3. Sends Discord/Telegram alert if risk is YELLOW, RED, or EMERGENCY
 * 4. Trips the circuit breaker in Firestore if EMERGENCY is detected
 * 5. Logs health record to `ranger_health`
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { db } from "../lib/firestore.js";
import { REGION } from "../config.js";
import type {
  RangerRatesDoc,
  RebalancerState,
  HealthRecord,
  RiskLevel,
  ProtocolId,
} from "./types.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const CIRCUIT_BREAKER_DRAWDOWN_PCT = 0.02; // 2%
const MAX_ALLOCATION_PCT = 0.70;
const MAX_UTILIZATION = 0.85;
const RATE_STALENESS_MS = 10 * 60 * 1_000;

// ─── Risk Assessment ──────────────────────────────────────────────────────────

interface RiskAssessment {
  level: RiskLevel;
  healthScore: number;
  drawdownPct: number;
  highestConcentrationProtocol: ProtocolId | null;
  highestConcentrationPct: number;
  utilizationWarnings: ProtocolId[];
}

function assessRisk(
  tvlEurc: number,
  peakTvlEurc: number,
  // Current allocation fractions (0–1)
  allocation: Record<ProtocolId, number>,
  rates: RangerRatesDoc,
  circuitBreakerTripped: boolean,
): RiskAssessment {
  // Drawdown from peak
  const drawdownPct =
    peakTvlEurc > 0
      ? Math.max(0, (peakTvlEurc - tvlEurc) / peakTvlEurc)
      : 0;

  // Concentration check
  let highestConcentrationProtocol: ProtocolId | null = null;
  let highestConcentrationPct = 0;
  for (const p of ["drift", "kamino", "save"] as ProtocolId[]) {
    if (allocation[p] > highestConcentrationPct) {
      highestConcentrationPct = allocation[p];
      highestConcentrationProtocol = p;
    }
  }

  // Utilization warnings
  const utilizationWarnings: ProtocolId[] = (
    ["drift", "kamino", "save"] as ProtocolId[]
  ).filter((p) => rates[p].utilization > MAX_UTILIZATION);

  // Health score: 50% drawdown, 30% concentration, 20% utilization
  const drawdownScore = Math.max(
    0,
    100 - (drawdownPct / CIRCUIT_BREAKER_DRAWDOWN_PCT) * 50,
  );
  const concentrationOver = Math.max(
    0,
    highestConcentrationPct - MAX_ALLOCATION_PCT,
  );
  const concentrationScore = Math.max(
    0,
    100 - (concentrationOver / (1 - MAX_ALLOCATION_PCT)) * 30,
  );
  const utilizationScore = Math.max(0, 100 - utilizationWarnings.length * 20);
  const healthScore = Math.round(
    drawdownScore * 0.5 + concentrationScore * 0.3 + utilizationScore * 0.2,
  );

  // Risk level
  let level: RiskLevel = "GREEN";
  if (circuitBreakerTripped || drawdownPct >= CIRCUIT_BREAKER_DRAWDOWN_PCT) {
    level = "EMERGENCY";
  } else if (
    drawdownPct >= CIRCUIT_BREAKER_DRAWDOWN_PCT * 0.75 ||
    highestConcentrationPct > MAX_ALLOCATION_PCT + 0.05
  ) {
    level = "RED";
  } else if (
    drawdownPct >= CIRCUIT_BREAKER_DRAWDOWN_PCT * 0.5 ||
    highestConcentrationPct > MAX_ALLOCATION_PCT ||
    utilizationWarnings.length > 0
  ) {
    level = "YELLOW";
  }

  return {
    level,
    healthScore,
    drawdownPct,
    highestConcentrationProtocol,
    highestConcentrationPct,
    utilizationWarnings,
  };
}

// ─── Alert sender ─────────────────────────────────────────────────────────────

interface AlertPayload {
  level: RiskLevel;
  healthScore: number;
  drawdownPct: number;
  protocol: ProtocolId | null;
  concentrationPct: number;
  utilizationWarnings: ProtocolId[];
  circuitBreakerTripped: boolean;
}

async function sendDiscordAlert(payload: AlertPayload): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    logger.warn("[healthCheck] DISCORD_WEBHOOK_URL not set — alert suppressed");
    return;
  }

  const colorMap: Record<RiskLevel, number> = {
    GREEN: 0x00ff00,
    YELLOW: 0xffff00,
    RED: 0xff0000,
    EMERGENCY: 0x8b0000,
  };

  const emoji: Record<RiskLevel, string> = {
    GREEN: "✅",
    YELLOW: "⚠️",
    RED: "🔴",
    EMERGENCY: "🚨",
  };

  const embed = {
    title: `${emoji[payload.level]} EURC Vault — Risk Level: ${payload.level}`,
    color: colorMap[payload.level],
    fields: [
      {
        name: "Health Score",
        value: `${payload.healthScore}/100`,
        inline: true,
      },
      {
        name: "Drawdown",
        value: `${(payload.drawdownPct * 100).toFixed(2)}%`,
        inline: true,
      },
      {
        name: "Top Concentration",
        value:
          payload.protocol !== null
            ? `${payload.protocol} @ ${(payload.concentrationPct * 100).toFixed(1)}%`
            : "N/A",
        inline: true,
      },
      ...(payload.utilizationWarnings.length > 0
        ? [
            {
              name: "High Utilization",
              value: payload.utilizationWarnings.join(", "),
              inline: false,
            },
          ]
        : []),
      ...(payload.circuitBreakerTripped
        ? [
            {
              name: "⛔ Circuit Breaker",
              value: "TRIPPED — all strategies paused",
              inline: false,
            },
          ]
        : []),
    ],
    timestamp: new Date().toISOString(),
    footer: { text: "Ranger EURC Yield Optimizer" },
  };

  const body = JSON.stringify({ embeds: [embed] });

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) {
    logger.warn("[healthCheck] Discord webhook failed", { status: res.status });
  }
}

// ─── Scheduled Function ───────────────────────────────────────────────────────

export const rangerHealthCheck = onSchedule(
  {
    schedule: "every 5 minutes",
    region: REGION,
    timeoutSeconds: 60,
    maxInstances: 1,
    memory: "256MiB",
  },
  async () => {
    logger.info("[healthCheck] Starting health check");
    const now = Date.now();

    // ── 1. Read latest rates ─────────────────────────────────────────────────
    const ratesSnap = await db.collection("ranger_rates").doc("latest").get();
    if (!ratesSnap.exists) {
      logger.warn("[healthCheck] No rates — skipping");
      return;
    }
    const rates = ratesSnap.data() as RangerRatesDoc;

    if (now - rates.fetchedAt > RATE_STALENESS_MS) {
      logger.warn("[healthCheck] Rates stale — may indicate fetchRates is down");
      // Still proceed — stale rates are themselves a health signal
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

    // ── 3. Estimate TVL and allocation ───────────────────────────────────────
    // TODO: Replace with real VoltrClient.getVaultState()
    const tvlEurc = state.peakTvlEurc > 0 ? state.peakTvlEurc : 100_000;
    const peakTvlEurc = Math.max(state.peakTvlEurc, tvlEurc);
    const allocation: Record<ProtocolId, number> = {
      drift: 0.50,
      kamino: 0.30,
      save: 0.15,
    };

    // ── 4. Assess risk ───────────────────────────────────────────────────────
    const risk = assessRisk(
      tvlEurc,
      peakTvlEurc,
      allocation,
      rates,
      state.circuitBreakerTripped,
    );

    logger.info("[healthCheck] Risk assessment", {
      level: risk.level,
      healthScore: risk.healthScore,
      drawdownPct: (risk.drawdownPct * 100).toFixed(2),
      utilizationWarnings: risk.utilizationWarnings,
    });

    // ── 5. Circuit breaker logic ─────────────────────────────────────────────
    let alertSent = false;
    if (risk.level === "EMERGENCY" && !state.circuitBreakerTripped) {
      const reason = `Health check: drawdown ${(risk.drawdownPct * 100).toFixed(2)}%`;
      await stateRef.set(
        {
          circuitBreakerTripped: true,
          circuitBreakerTrippedAt: now,
          circuitBreakerReason: reason,
          updatedAt: now,
        } satisfies Partial<RebalancerState>,
        { merge: true },
      );
      logger.error("[healthCheck] CIRCUIT BREAKER TRIPPED", { reason });
    }

    // ── 6. Send alert for non-GREEN states ───────────────────────────────────
    if (risk.level !== "GREEN") {
      try {
        await sendDiscordAlert({
          level: risk.level,
          healthScore: risk.healthScore,
          drawdownPct: risk.drawdownPct,
          protocol: risk.highestConcentrationProtocol,
          concentrationPct: risk.highestConcentrationPct,
          utilizationWarnings: risk.utilizationWarnings,
          circuitBreakerTripped: state.circuitBreakerTripped,
        });
        alertSent = true;
      } catch (err) {
        logger.warn("[healthCheck] Alert failed", { error: String(err) });
      }
    }

    // ── 7. Log health record ─────────────────────────────────────────────────
    const record: HealthRecord = {
      level: risk.level,
      healthScore: risk.healthScore,
      drawdownPct: risk.drawdownPct * 100,
      highestConcentrationProtocol: risk.highestConcentrationProtocol,
      highestConcentrationPct: risk.highestConcentrationPct * 100,
      utilizationWarnings: risk.utilizationWarnings,
      circuitBreakerTripped: state.circuitBreakerTripped,
      alertSent,
      timestamp: now,
    };

    await db.collection("ranger_health").add(record);
  },
);
