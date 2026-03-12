import { EURC_DECIMALS, PRECISION, SECONDS_PER_YEAR, ONE_EURC } from "./constants";

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

  // Pad fractional to 2 decimal places (EURC only needs 2 display decimals)
  const fracStr = fractional
    .toString()
    .padStart(EURC_DECIMALS, "0")
    .slice(0, 2);

  // Add thousands separators to the whole part
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  const sign = isNegative ? "-" : "";
  return `${sign}${wholeStr}.${fracStr} EURC`;
}

/**
 * Parse a human-readable EURC string to base units (bigint).
 *
 * Accepts: "100", "100.50", "1,234.56", "1234.56 EURC"
 *
 * @example parseEurc("100.50")  // 100500000n
 */
export function parseEurc(amount: string): bigint {
  // Strip currency label, whitespace, and thousands separators
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

  // Validate numeric
  if (!/^\d+$/.test(wholePart) || (fracPart !== "" && !/^\d+$/.test(fracPart))) {
    throw new Error(`Invalid EURC amount: "${amount}"`);
  }

  // Truncate or pad fractional to EURC_DECIMALS
  if (fracPart.length > EURC_DECIMALS) {
    fracPart = fracPart.slice(0, EURC_DECIMALS);
  } else {
    fracPart = fracPart.padEnd(EURC_DECIMALS, "0");
  }

  return BigInt(wholePart) * BigInt(10 ** EURC_DECIMALS) + BigInt(fracPart);
}

// ---------------------------------------------------------------------------
// Reward math (mirrors on-chain MasterChef math in utils/math.rs)
// ---------------------------------------------------------------------------

/**
 * Calculate pending (unclaimed) rewards for a user.
 *
 * Formula: `(depositedAmount * accRewardPerShare / PRECISION) - rewardDebt`
 *
 * All inputs are in base units / raw u128 values.
 */
export function calculatePendingRewards(
  depositedAmount: bigint,
  accRewardPerShare: bigint,
  rewardDebt: bigint,
): bigint {
  if (depositedAmount === 0n) return 0n;

  const accumulated = (depositedAmount * accRewardPerShare) / PRECISION;
  const pending = accumulated - rewardDebt;
  return pending < 0n ? 0n : pending;
}

// ---------------------------------------------------------------------------
// APY & projection helpers
// ---------------------------------------------------------------------------

/**
 * Estimate annualized APY from a single epoch's reward distribution.
 *
 * @param totalRewardsPerEpoch  - Total EURC rewards distributed in the epoch (base units)
 * @param totalDeposits         - Total EURC deposited at the time (base units)
 * @param epochDurationSeconds  - Duration of the epoch in seconds
 * @returns APY as a percentage (e.g. 5.25 means 5.25%)
 */
export function calculateApy(
  totalRewardsPerEpoch: bigint | number,
  totalDeposits: bigint | number,
  epochDurationSeconds: number,
): number {
  const rewards = Number(totalRewardsPerEpoch);
  const deposits = Number(totalDeposits);

  if (deposits === 0 || epochDurationSeconds <= 0) return 0;

  const epochRate = rewards / deposits;
  const epochsPerYear = SECONDS_PER_YEAR / epochDurationSeconds;

  // Simple annualization: APY = ((1 + epochRate)^epochsPerYear - 1) * 100
  const apy = (Math.pow(1 + epochRate, epochsPerYear) - 1) * 100;
  return apy;
}

/**
 * Calculate projected earnings for a deposit over a given number of days.
 *
 * @param depositAmount  - EURC base units to deposit
 * @param apy            - Annual percentage yield (e.g. 5.25 for 5.25%)
 * @param daysAhead      - Number of days to project
 * @returns Projected earnings in EURC base units
 */
export function calculateProjectedEarnings(
  depositAmount: bigint | number,
  apy: number,
  daysAhead: number,
): number {
  const principal = Number(depositAmount);
  if (principal === 0 || apy === 0 || daysAhead <= 0) return 0;

  const dailyRate = apy / 100 / 365.25;
  // Compound: P * ((1 + r)^d - 1)
  const earnings = principal * (Math.pow(1 + dailyRate, daysAhead) - 1);
  return Math.floor(earnings);
}

// ---------------------------------------------------------------------------
// Epoch time helpers
// ---------------------------------------------------------------------------

/**
 * Get the progress of the current epoch as a number between 0 and 1.
 *
 * @param epochStartTime  - Unix timestamp (seconds) when the epoch started
 * @param epochDuration   - Epoch duration in seconds
 * @returns A number between 0 (just started) and 1 (ended / past due)
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
 *
 * @param epochStartTime  - Unix timestamp (seconds) when the epoch started
 * @param epochDuration   - Epoch duration in seconds
 * @returns Seconds remaining, or 0 if the epoch has already ended
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
 *
 * @param withdrawalAvailableAt  - Unix timestamp (seconds) when withdrawal unlocks
 * @returns Seconds remaining, or 0 if already available
 */
export function getWithdrawalTimeRemaining(
  withdrawalAvailableAt: number,
): number {
  if (withdrawalAvailableAt === 0) return 0;
  const now = Math.floor(Date.now() / 1000);
  const remaining = withdrawalAvailableAt - now;
  return remaining > 0 ? remaining : 0;
}
