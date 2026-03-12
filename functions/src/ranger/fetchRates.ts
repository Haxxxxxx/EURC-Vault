/**
 * Ranger — fetchRates Cloud Function
 *
 * Scheduled every 5 minutes.
 * Fetches EURC supply rates from Drift, Kamino, and Save via their REST APIs.
 * Stores latest rates in Firestore `ranger_rates/latest`.
 * Appends to `ranger_rates_history` for trend analysis.
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { db } from "../lib/firestore.js";
import { REGION } from "../config.js";
import type { RangerRate, RangerRatesDoc, ProtocolId } from "./types.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const EURC_MINT = "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr";
const MAX_UTILIZATION = 0.85;
const FETCH_TIMEOUT_MS = 10_000;

/** Conservative fallback APYs if a protocol API is unreachable */
const FALLBACK_APYS: Record<ProtocolId, number> = {
  drift: 0.075,
  kamino: 0.065,
  save: 0.055,
};

// ─── Protocol rate fetchers ───────────────────────────────────────────────────

/**
 * Fetch EURC supply rate from Kamino Finance REST API.
 * Endpoint: GET https://api.kamino.finance/v2/reserves?env=mainnet-beta
 */
async function fetchKaminoRate(): Promise<RangerRate> {
  const url = "https://api.kamino.finance/v2/reserves?env=mainnet-beta";

  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: "application/json" },
  });

  if (!res.ok) throw new Error(`Kamino API ${res.status}`);

  const data = (await res.json()) as Array<{
    mintAddress?: string;
    supplyInterestAPY?: number;
    utilizationRate?: number;
  }>;

  const reserve = data.find((r) => r.mintAddress === EURC_MINT);
  if (!reserve) throw new Error("EURC reserve not found in Kamino response");

  const apy = (reserve.supplyInterestAPY ?? 0) / 100; // API returns e.g. 7.5 for 7.5%
  const utilization = reserve.utilizationRate ?? 0;

  return {
    protocol: "kamino",
    apy,
    apyBps: Math.round(apy * 10_000),
    utilization,
    isStale: false,
    fetchedAt: Date.now(),
  };
}

/**
 * Fetch EURC supply rate from Drift Protocol.
 * Uses Drift's public stats API for spot market rates.
 * Spot market index 15 = EURC on mainnet.
 */
async function fetchDriftRate(): Promise<RangerRate> {
  // Drift's public market stats endpoint
  const DRIFT_SPOT_MARKET_INDEX = Number(
    process.env.DRIFT_SPOT_MARKET_INDEX ?? "15",
  );
  const url = `https://data.api.drift.trade/spot/market/stats?marketIndex=${DRIFT_SPOT_MARKET_INDEX}`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: "application/json" },
  });

  if (!res.ok) throw new Error(`Drift API ${res.status}`);

  const data = (await res.json()) as {
    depositRate?: number;
    utilizationRatio?: number;
    supplyApy?: number;
  };

  // Drift returns rates as percentages (e.g. 8.2 for 8.2%)
  const rawApy = data.supplyApy ?? data.depositRate ?? 0;
  const apy = rawApy > 1 ? rawApy / 100 : rawApy; // normalize if needed
  const utilization = data.utilizationRatio ?? 0;

  return {
    protocol: "drift",
    apy,
    apyBps: Math.round(apy * 10_000),
    utilization,
    isStale: false,
    fetchedAt: Date.now(),
  };
}

/**
 * Fetch EURC supply rate from Save Finance (formerly Solend).
 * Uses Save's REST API for reserve data.
 */
async function fetchSaveRate(): Promise<RangerRate> {
  const url = "https://api.save.finance/v1/reserves";

  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: "application/json" },
  });

  if (!res.ok) throw new Error(`Save API ${res.status}`);

  const data = (await res.json()) as Array<{
    mintAddress?: string;
    supplyApy?: number;
    utilizationRate?: number;
    liquidityMint?: string;
  }>;

  // Try both mintAddress and liquidityMint fields
  const reserve = data.find(
    (r) => r.mintAddress === EURC_MINT || r.liquidityMint === EURC_MINT,
  );

  if (!reserve) throw new Error("EURC reserve not found in Save response");

  const rawApy = reserve.supplyApy ?? 0;
  const apy = rawApy > 1 ? rawApy / 100 : rawApy; // normalize
  const utilization = reserve.utilizationRate ?? 0;

  return {
    protocol: "save",
    apy,
    apyBps: Math.round(apy * 10_000),
    utilization,
    isStale: false,
    fetchedAt: Date.now(),
  };
}

/** Create a stale fallback rate for a protocol */
function fallbackRate(protocol: ProtocolId): RangerRate {
  const apy = FALLBACK_APYS[protocol];
  return {
    protocol,
    apy,
    apyBps: Math.round(apy * 10_000),
    utilization: 0.5,
    isStale: true,
    fetchedAt: Date.now(),
  };
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

async function fetchWithFallback(
  protocol: ProtocolId,
  fetcher: () => Promise<RangerRate>,
): Promise<RangerRate> {
  try {
    const rate = await fetcher();
    logger.debug(`[fetchRates] ${protocol}: ${(rate.apy * 100).toFixed(2)}% APY`);
    return rate;
  } catch (err) {
    logger.warn(`[fetchRates] ${protocol} fetch failed — using fallback`, {
      error: String(err),
    });
    return fallbackRate(protocol);
  }
}

function buildDoc(
  drift: RangerRate,
  kamino: RangerRate,
  save: RangerRate,
): RangerRatesDoc {
  const protocols: Array<[ProtocolId, number]> = [
    ["drift", drift.utilization <= MAX_UTILIZATION ? drift.apy : 0],
    ["kamino", kamino.utilization <= MAX_UTILIZATION ? kamino.apy : 0],
    ["save", save.utilization <= MAX_UTILIZATION ? save.apy : 0],
  ];

  const sorted = [...protocols].sort((a, b) => b[1] - a[1]);
  const best = sorted[0][0];
  const worst = sorted[sorted.length - 1][0];
  const spreadBps = Math.round(
    (sorted[0][1] - sorted[sorted.length - 1][1]) * 10_000,
  );

  return {
    drift,
    kamino,
    save,
    best,
    worst,
    spreadBps,
    fetchedAt: Date.now(),
  };
}

// ─── Scheduled Function ───────────────────────────────────────────────────────

export const rangerFetchRates = onSchedule(
  {
    schedule: "every 5 minutes",
    region: REGION,
    timeoutSeconds: 60,
    maxInstances: 1,
    memory: "256MiB",
  },
  async () => {
    logger.info("[fetchRates] Starting rate fetch cycle");
    const start = Date.now();

    const [drift, kamino, save] = await Promise.all([
      fetchWithFallback("drift", fetchDriftRate),
      fetchWithFallback("kamino", fetchKaminoRate),
      fetchWithFallback("save", fetchSaveRate),
    ]);

    const doc = buildDoc(drift, kamino, save);

    // Write `ranger_rates/latest` — overwrite
    await db.collection("ranger_rates").doc("latest").set(doc);

    // Append to history for trend charts
    await db.collection("ranger_rates_history").add(doc);

    const elapsed = Date.now() - start;
    logger.info("[fetchRates] Complete", {
      elapsedMs: elapsed,
      drift: `${(drift.apy * 100).toFixed(2)}%`,
      kamino: `${(kamino.apy * 100).toFixed(2)}%`,
      save: `${(save.apy * 100).toFixed(2)}%`,
      best: doc.best,
      spreadBps: doc.spreadBps,
      staleCount: [drift, kamino, save].filter((r) => r.isStale).length,
    });
  },
);
