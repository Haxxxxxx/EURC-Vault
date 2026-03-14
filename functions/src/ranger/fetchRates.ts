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

const MAX_UTILIZATION = 0.85;
const FETCH_TIMEOUT_MS = 10_000;

// EURC reserve addresses
const KAMINO_MARKET = "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF";
const KAMINO_EURC_RESERVE = "EGPE45iPkme8G8C1xFDNZoZeHdP3aRYtaAfAQuuwrcGZ";
const SAVE_EURC_RESERVE = "ECNduHkbaQL5mgNenGCwYhXtdv4tqVjeRcCYwUeQQHc1";

/** Conservative fallback APYs if a protocol API is unreachable */
const FALLBACK_APYS: Record<ProtocolId, number> = {
  drift: 0.009,
  kamino: 0.003,
  save: 0.002,
};

// ─── Protocol rate fetchers ───────────────────────────────────────────────────

/**
 * Drift: GET /stats/EURC/rateHistory/deposit
 * Returns { success, rates: [[timestamp, annualizedDecimal], ...] }
 */
async function fetchDriftRate(): Promise<RangerRate> {
  const url = "https://data.api.drift.trade/stats/EURC/rateHistory/deposit";
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Drift API ${res.status}`);

  const data = (await res.json()) as {
    success?: boolean;
    rates?: Array<[number, number]>;
  };
  if (!data.success || !data.rates?.length)
    throw new Error("No Drift rate data");

  const latestRate = data.rates[data.rates.length - 1][1];

  // Fetch utilization from market stats
  let utilization = 0;
  try {
    const mktRes = await fetch(
      "https://data.api.drift.trade/stats/markets",
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );
    if (mktRes.ok) {
      const body = (await mktRes.json()) as {
        markets?: Array<{
          symbol?: string;
          deposits?: string;
          borrows?: string;
        }>;
      };
      const eurc = body.markets?.find((m) => m.symbol === "EURC");
      if (eurc) {
        const deposits = parseFloat(eurc.deposits ?? "0");
        const borrows = parseFloat(eurc.borrows ?? "0");
        if (deposits > 0) utilization = borrows / deposits;
      }
    }
  } catch {
    /* utilization is optional */
  }

  return {
    protocol: "drift",
    apy: latestRate,
    apyBps: Math.round(latestRate * 10_000),
    utilization,
    isStale: false,
    fetchedAt: Date.now(),
  };
}

/**
 * Kamino: GET /kamino-market/{market}/reserves/{reserve}/metrics/history
 * Returns { history: [{ metrics: { supplyInterestAPY, ... } }] }
 */
async function fetchKaminoRate(): Promise<RangerRate> {
  const end = new Date().toISOString();
  const start = new Date(Date.now() - 2 * 3600_000).toISOString();
  const url = `https://api.kamino.finance/kamino-market/${KAMINO_MARKET}/reserves/${KAMINO_EURC_RESERVE}/metrics/history?start=${start}&end=${end}`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Kamino API ${res.status}`);

  const data = (await res.json()) as {
    history?: Array<{
      metrics?: {
        supplyInterestAPY?: number;
        totalSupply?: string;
        totalBorrows?: string;
      };
    }>;
  };

  const latest = data.history?.[data.history.length - 1]?.metrics;
  if (!latest) throw new Error("No Kamino metrics data");

  const apy = latest.supplyInterestAPY ?? 0;
  const supply = parseFloat(latest.totalSupply ?? "0");
  const borrows = parseFloat(latest.totalBorrows ?? "0");
  const utilization = supply > 0 ? borrows / supply : 0;

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
 * Save: GET /v1/reserves?ids={reserveAddress}
 * Returns { results: [{ rates: { supplyInterest: "0.23" }, ... }] }
 */
async function fetchSaveRate(): Promise<RangerRate> {
  const url = `https://api.save.finance/v1/reserves?ids=${SAVE_EURC_RESERVE}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Save API ${res.status}`);

  const data = (await res.json()) as {
    results?: Array<{
      rates?: { supplyInterest?: string };
      reserve?: {
        liquidity?: {
          availableAmount?: string;
          borrowedAmountWads?: string;
        };
      };
    }>;
  };

  const result = data.results?.[0];
  if (!result?.rates) throw new Error("No Save rates data");

  const apyPct = parseFloat(result.rates.supplyInterest ?? "0");
  const apy = apyPct / 100;

  let utilization = 0;
  const liq = result.reserve?.liquidity;
  if (liq) {
    const available = parseFloat(liq.availableAmount ?? "0") / 1e6;
    const borrowed =
      parseFloat(liq.borrowedAmountWads ?? "0") / 1e18 / 1e6;
    const total = available + borrowed;
    if (total > 0) utilization = borrowed / total;
  }

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
    logger.debug(
      `[fetchRates] ${protocol}: ${(rate.apy * 100).toFixed(2)}% APY`,
    );
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
