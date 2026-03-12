/**
 * Auto-Compounder — detects accrued interest and re-deploys it.
 *
 * Flow:
 * 1. Compare current vault TVL vs last recorded TVL
 * 2. If delta > COMPOUND_MIN_AMOUNT → interest has accrued
 * 3. Withdraw the accrued interest from the protocol it came from
 * 4. Re-deposit into the highest-rate protocol at the time of compounding
 * 5. Log the compound event
 *
 * This increases the effective APY by compounding hourly vs monthly.
 */
import {
  COMPOUND_MIN_AMOUNT,
} from '../config.js';
import type {
  VaultState,
  CompoundEvent,
  ProtocolId,
} from '../types.js';
import type { AggregatedRates } from '../rates/aggregator.js';
import logger from '../monitoring/logger.js';

const log = logger.child('engine:compounder');

// Track TVL at last compound for delta calculation
let _lastRecordedTvl: number = 0;
let _lastCompoundAt: Date | null = null;

export function setLastRecordedTvl(tvl: number): void {
  _lastRecordedTvl = tvl;
}

export function getLastCompoundAt(): Date | null {
  return _lastCompoundAt;
}

/**
 * Evaluate whether auto-compounding should run.
 *
 * @returns The accrued amount in EURC atoms, or 0 if compounding should be skipped.
 */
export function shouldCompound(currentTvl: number): {
  should: boolean;
  accruedAmount: number;
  reason: string;
} {
  if (_lastRecordedTvl === 0) {
    return { should: false, accruedAmount: 0, reason: 'No baseline TVL recorded yet' };
  }

  const accruedAmount = currentTvl - _lastRecordedTvl;

  if (accruedAmount <= 0) {
    return {
      should: false,
      accruedAmount: 0,
      reason: `TVL decreased by ${(-accruedAmount / 1_000_000).toFixed(4)} EURC — skipping`,
    };
  }

  if (accruedAmount < COMPOUND_MIN_AMOUNT) {
    return {
      should: false,
      accruedAmount,
      reason: `Accrued ${(accruedAmount / 1_000_000).toFixed(4)} EURC < min ${(COMPOUND_MIN_AMOUNT / 1_000_000).toFixed(2)} EURC`,
    };
  }

  return {
    should: true,
    accruedAmount,
    reason: `${(accruedAmount / 1_000_000).toFixed(4)} EURC accrued ≥ minimum`,
  };
}

/**
 * Execute an auto-compound cycle.
 *
 * @returns CompoundEvent describing what happened (success or failure)
 */
export async function runCompound(
  vaultState: VaultState,
  rates: AggregatedRates,
  executeCompoundTx: (
    harvestedAmount: number,
    fromProtocol: ProtocolId,
    toProtocol: ProtocolId,
  ) => Promise<string | null>,
): Promise<CompoundEvent | null> {
  const { should, accruedAmount, reason } = shouldCompound(vaultState.totalAssets);

  if (!should) {
    log.debug('Compound skipped', { reason });
    return null;
  }

  log.info('Compounding accrued interest', {
    accruedEurc: (accruedAmount / 1_000_000).toFixed(4),
    bestProtocol: rates.best,
  });

  // Determine source: harvest from the protocol with most deployed capital
  const allocationByProtocol: Array<[ProtocolId, number]> = [
    ['drift',  vaultState.driftAllocation],
    ['kamino', vaultState.kaminoAllocation],
    ['save',   vaultState.saveAllocation],
  ];
  const sourceProtocol = allocationByProtocol.reduce(
    (max, [p, v]) => (v > max[1] ? [p, v] : max),
    ['drift' as ProtocolId, 0] as [ProtocolId, number],
  )[0];

  const targetProtocol = rates.best;

  const event: CompoundEvent = {
    id:             `compound_${Date.now()}`,
    protocol:       sourceProtocol,
    harvestedAmount: accruedAmount,
    redeployedTo:   targetProtocol,
    txSignature:    null,
    timestamp:      new Date(),
    success:        false,
  };

  try {
    const txSig = await executeCompoundTx(accruedAmount, sourceProtocol, targetProtocol);
    event.txSignature = txSig;
    event.success     = true;

    // Update baseline
    _lastRecordedTvl = vaultState.totalAssets;
    _lastCompoundAt  = new Date();

    log.info('Compound complete', {
      harvestedEurc: (accruedAmount / 1_000_000).toFixed(4),
      source:  sourceProtocol,
      target:  targetProtocol,
      txSig:   txSig ?? 'simulated',
    });
  } catch (err) {
    event.errorMessage = err instanceof Error ? err.message : String(err);
    log.error('Compound execution failed', err);
  }

  return event;
}
