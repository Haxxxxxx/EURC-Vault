/**
 * Vault Reader — fetches on-chain vault state using @voltr/vault-sdk.
 *
 * Maps Ranger Earn vault accounts to our internal VaultState type so the
 * rest of the bot (rebalancer, risk engine, compounder) can work with a
 * consistent view of the world.
 *
 * Falls back to a mock VaultState when VAULT_ADDRESS is not configured
 * (simulation / demo mode).
 *
 * SDK account shapes (from @voltr/vault-sdk v0.2.0):
 *   fetchVaultAccount → { asset, lp, manager, admin, vaultConfiguration, ... }
 *     NOTE: no totalAsset/totalShares — TVL comes from getPositionAndTotalValuesForVault
 *   getPositionAndTotalValuesForVault → { totalValue, strategies: [{strategyId, amount}] }
 *   fetchAllStrategyInitReceiptAccountsOfVault → account.positionValue (not depositedAmount)
 */
import { Connection, PublicKey } from '@solana/web3.js';
import { VoltrClient } from '@voltr/vault-sdk';

import {
  SOLANA_RPC_URL,
  VAULT_ADDRESS,
  STRATEGY_ADDRESSES,
} from '../config.js';
import type { ProtocolId, VaultState } from '../types.js';
import logger from '../monitoring/logger.js';

const log = logger.child('engine:vault-reader');

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch live vault state from the chain.
 *
 * Returns a VaultState populated from on-chain data when VAULT_ADDRESS is set,
 * or a simulated VaultState otherwise.
 */
export async function fetchVaultState(
  connection?: Connection,
): Promise<VaultState & { isLive: boolean }> {
  if (!VAULT_ADDRESS) {
    log.debug('VAULT_ADDRESS not set — returning simulated vault state');
    return simulatedVaultState();
  }

  const conn        = connection ?? new Connection(SOLANA_RPC_URL, 'confirmed');
  const vaultPubkey = new PublicKey(VAULT_ADDRESS);

  // VoltrClient in read-only mode (no wallet needed for queries)
  const client = new VoltrClient(conn);

  try {
    // getPositionAndTotalValuesForVault returns { totalValue, strategies: [{strategyId, amount}] }
    // fetchVaultAccount does NOT have totalAsset/totalShares — use positionData for TVL
    const positionData = await client.getPositionAndTotalValuesForVault(vaultPubkey);

    const totalAssets = typeof positionData.totalValue?.toNumber === 'function'
      ? positionData.totalValue.toNumber()
      : Number(positionData.totalValue ?? 0);

    let driftAllocation  = 0;
    let kaminoAllocation = 0;
    let saveAllocation   = 0;

    for (const pos of positionData.strategies) {
      const value = typeof pos.amount?.toNumber === 'function'
        ? pos.amount.toNumber()
        : Number(pos.amount ?? 0);

      if (STRATEGY_ADDRESSES.drift  && pos.strategyId === STRATEGY_ADDRESSES.drift)  driftAllocation  = value;
      if (STRATEGY_ADDRESSES.kamino && pos.strategyId === STRATEGY_ADDRESSES.kamino) kaminoAllocation = value;
      if (STRATEGY_ADDRESSES.save   && pos.strategyId === STRATEGY_ADDRESSES.save)   saveAllocation   = value;
    }

    const deployedTotal = driftAllocation + kaminoAllocation + saveAllocation;
    const idleBalance   = Math.max(0, totalAssets - deployedTotal);

    const state: VaultState & { isLive: boolean } = {
      totalAssets,
      totalShares:      0,   // LP supply not in vault account; query LP mint for precision
      driftAllocation,
      kaminoAllocation,
      saveAllocation,
      idleBalance,
      peakTvl:         totalAssets,
      lastRebalanceAt: null,
      lastCompoundAt:  null,
      isLive:          true,
    };

    log.debug('Vault state fetched', {
      totalAssets:  `${(totalAssets    / 1_000_000).toFixed(4)} EURC`,
      drift:        `${(driftAllocation  / 1_000_000).toFixed(4)} EURC`,
      kamino:       `${(kaminoAllocation / 1_000_000).toFixed(4)} EURC`,
      save:         `${(saveAllocation   / 1_000_000).toFixed(4)} EURC`,
      idle:         `${(idleBalance      / 1_000_000).toFixed(4)} EURC`,
    });

    return state;
  } catch (err) {
    log.warn('⚠ Failed to fetch vault state from chain — falling back to SIMULATED state. '
      + 'Bot decisions will use synthetic data until on-chain reads recover.', err);
    return simulatedVaultState();
  }
}

/**
 * Fetch per-strategy positions using receipt accounts.
 * positionValue is the last-known value from the receipt account.
 */
export async function fetchStrategyPositions(
  connection?: Connection,
): Promise<Record<ProtocolId, number>> {
  const positions: Record<ProtocolId, number> = { drift: 0, kamino: 0, save: 0 };

  if (!VAULT_ADDRESS) return positions;

  const conn        = connection ?? new Connection(SOLANA_RPC_URL, 'confirmed');
  const vaultPubkey = new PublicKey(VAULT_ADDRESS);
  const client      = new VoltrClient(conn);

  try {
    const receipts = await client.fetchAllStrategyInitReceiptAccountsOfVault(vaultPubkey);
    log.debug(`Fetched ${receipts.length} strategy receipts`);

    for (const receipt of receipts) {
      const strategyStr = receipt.account.strategy?.toBase58?.() ?? '';
      // positionValue is the correct field (not depositedAmount)
      const value = typeof receipt.account.positionValue?.toNumber === 'function'
        ? receipt.account.positionValue.toNumber()
        : Number(receipt.account.positionValue ?? 0);

      for (const protocol of ['drift', 'kamino', 'save'] as ProtocolId[]) {
        if (STRATEGY_ADDRESSES[protocol] && strategyStr === STRATEGY_ADDRESSES[protocol]) {
          positions[protocol] = value;
        }
      }
    }
  } catch (err) {
    log.warn('Failed to fetch strategy receipts', { err: String(err) });
  }

  return positions;
}

/**
 * Calculate how many EURC a given amount of LP tokens is worth.
 */
export async function calculateWithdrawValue(
  lpAmount: number,
  connection?: Connection,
): Promise<number> {
  if (!VAULT_ADDRESS) return lpAmount; // 1:1 in simulation

  const conn        = connection ?? new Connection(SOLANA_RPC_URL, 'confirmed');
  const vaultPubkey = new PublicKey(VAULT_ADDRESS);
  const client      = new VoltrClient(conn);

  const BN = (await import('bn.js')).default;
  const assetAmount = await client.calculateAssetsForWithdraw(
    vaultPubkey,
    new BN(lpAmount),
  );
  return typeof assetAmount.toNumber === 'function'
    ? assetAmount.toNumber()
    : Number(assetAmount);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Returns a simulated vault state for demo / CI mode */
function simulatedVaultState(): VaultState & { isLive: boolean } {
  const totalAssets = 1_000_000 * 1_000_000; // 1M EURC in atoms
  return {
    totalAssets,
    totalShares:      totalAssets,
    driftAllocation:  Math.floor(totalAssets * 0.40),
    kaminoAllocation: Math.floor(totalAssets * 0.35),
    saveAllocation:   Math.floor(totalAssets * 0.20),
    idleBalance:      Math.floor(totalAssets * 0.05),
    peakTvl:          totalAssets,
    lastRebalanceAt:  null,
    lastCompoundAt:   null,
    isLive:           false,
  };
}
