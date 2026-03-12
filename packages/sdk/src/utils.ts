import { EURC_DECIMALS, PRECISION, SECONDS_PER_YEAR } from "./constants";

// ---------------------------------------------------------------------------
// EURC formatting
// ---------------------------------------------------------------------------

/**
 * Format EURC base units to a human-readable string with thousands separators.
 *
 * @example formatEurc(1234560000n)  // "1,234.56 EURC"
 * @example formatEurc(500000)       // "0.50 EURC"
 */
export function formatEurc(amount: bigint | number): string {
  const raw = typeof amount === "number" ? BigInt(amount) : amount;
  const isNegative = raw < 0n;
  const abs = isNegative ? -raw : raw;

  const divisor = BigInt(10 ** EURC_DECIMALS);
  const whole = abs / divisor;
  const fractional = abs % divisor;

  const fracStr = fractional
    .toString()
    .padStart(EURC_DECIMALS, "0")
    .slice(0, 2);

  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  const sign = isNegative ? "-" : "";
  return `${sign}${wholeStr}.${fracStr} EURC`;
}

/**
 * Parse a human-readable EURC string to base units (bigint).
 *
 * Accepts: "100", "100.50", "1,234.56", "1234.56 EURC"
 */
export function parseEurc(amount: string): bigint {
  const cleaned = amount.replace(/\s*EURC\s*/gi, "").replace(/,/g, "").trim();

  if (cleaned === "" || cleaned === ".") {
    throw new Error(`Invalid EURC amount: "${amount}"`);
  }

  const parts = cleaned.split(".");
  if (parts.length > 2) {
    throw new Error(`Invalid EURC amount: "${amount}"`);
  }

  const wholePart = parts[0] ?? "0";
  let fracPart = parts[1] ?? "";

  if (!/^\d+$/.test(wholePart) || (fracPart !== "" && !/^\d+$/.test(fracPart))) {
    throw new Error(`Invalid EURC amount: "${amount}"`);
  }

  if (fracPart.length > EURC_DECIMALS) {
    fracPart = fracPart.slice(0, EURC_DECIMALS);
  } else {
    fracPart = fracPart.padEnd(EURC_DECIMALS, "0");
  }

  return BigInt(wholePart) * BigInt(10 ** EURC_DECIMALS) + BigInt(fracPart);
}

// ---------------------------------------------------------------------------
// pbEURC exchange rate math (mirrors on-chain utils/math.rs)
// ---------------------------------------------------------------------------

/**
 * Calculate exchange rate: EURC per pbEURC, scaled by PRECISION.
 * Returns PRECISION (1:1) when supply is 0.
 */
export function calculateExchangeRate(
  totalEurc: bigint,
  totalSupply: bigint,
): bigint {
  if (totalSupply === 0n) return PRECISION;
  return (totalEurc * PRECISION) / totalSupply;
}

/**
 * Convert EURC amount to pbEURC shares at the given exchange rate.
 * Rounds DOWN to protect the vault.
 */
export function eurcToShares(
  eurcAmount: bigint,
  exchangeRate: bigint,
): bigint {
  if (exchangeRate === 0n) return 0n;
  return (eurcAmount * PRECISION) / exchangeRate;
}

/**
 * Convert pbEURC shares to EURC amount at the given exchange rate.
 * Rounds DOWN.
 */
export function sharesToEurc(
  shares: bigint,
  exchangeRate: bigint,
): bigint {
  return (shares * exchangeRate) / PRECISION;
}

/**
 * Calculate the EURC value of a user's pbEURC position.
 */
export function calculatePositionValue(
  pbEurcBalance: bigint,
  exchangeRate: bigint,
): bigint {
  return sharesToEurc(pbEurcBalance, exchangeRate);
}

/**
 * Calculate yield earned: current position value minus original deposits.
 * Returns 0 if negative (shouldn't happen in normal operation).
 */
export function calculateYieldEarned(
  pbEurcBalance: bigint,
  exchangeRate: bigint,
  originalDepositsEurc: bigint,
): bigint {
  const currentValue = calculatePositionValue(pbEurcBalance, exchangeRate);
  const yield_ = currentValue - originalDepositsEurc;
  return yield_ < 0n ? 0n : yield_;
}

// ---------------------------------------------------------------------------
// APY calculation
// ---------------------------------------------------------------------------

/**
 * Calculate APY from exchange rate growth between two epochs.
 *
 * @param startRate    - Exchange rate at epoch start (scaled by PRECISION)
 * @param endRate      - Exchange rate at epoch end (scaled by PRECISION)
 * @param durationSecs - Duration between the two snapshots in seconds
 * @returns APY as a percentage (e.g. 5.25 means 5.25%)
 */
export function calculateApy(
  startRate: bigint | number,
  endRate: bigint | number,
  durationSecs: number,
): number {
  const start = Number(startRate);
  const end = Number(endRate);

  if (start === 0 || durationSecs <= 0 || end <= start) return 0;

  const growthRate = end / start - 1;
  const periodsPerYear = SECONDS_PER_YEAR / durationSecs;

  // APY = ((1 + growthRate)^periodsPerYear - 1) * 100
  return (Math.pow(1 + growthRate, periodsPerYear) - 1) * 100;
}

/**
 * Calculate projected earnings for a deposit over a given number of days.
 */
export function calculateProjectedEarnings(
  depositAmount: bigint | number,
  apy: number,
  daysAhead: number,
): number {
  const principal = Number(depositAmount);
  if (principal === 0 || apy === 0 || daysAhead <= 0) return 0;

  const dailyRate = apy / 100 / 365.25;
  const earnings = principal * (Math.pow(1 + dailyRate, daysAhead) - 1);
  return Math.floor(earnings);
}

// ---------------------------------------------------------------------------
// Epoch time helpers
// ---------------------------------------------------------------------------

/**
 * Get the progress of the current epoch as a number between 0 and 1.
 */
export function getEpochProgress(
  epochStartTime: number,
  epochDuration: number,
): number {
  if (epochDuration <= 0) return 1;
  const now = Math.floor(Date.now() / 1000);
  const elapsed = now - epochStartTime;
  if (elapsed <= 0) return 0;
  return Math.min(elapsed / epochDuration, 1);
}

/**
 * Get the remaining time in the current epoch.
 */
export function getEpochTimeRemaining(
  epochStartTime: number,
  epochDuration: number,
): number {
  const now = Math.floor(Date.now() / 1000);
  const endTime = epochStartTime + epochDuration;
  const remaining = endTime - now;
  return remaining > 0 ? remaining : 0;
}

/**
 * Get the remaining time until a pending withdrawal becomes available.
 */
export function getWithdrawalTimeRemaining(
  withdrawalAvailableAt: number,
): number {
  if (withdrawalAvailableAt === 0) return 0;
  const now = Math.floor(Date.now() / 1000);
  const remaining = withdrawalAvailableAt - now;
  return remaining > 0 ? remaining : 0;
}
