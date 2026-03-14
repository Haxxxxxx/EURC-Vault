'use client';

import { useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { VoltrClient } from '@voltr/vault-sdk';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { VAULT_ADDRESS, EURC_MINT, EURC_PRECISION } from '@/lib/constants';

export interface VaultSnapshot {
  /** User's EURC balance (UI amount) */
  eurcBalance: number;
  /** User's LP/pbEURC shares (UI amount) */
  userShares: number;
  /** Current EURC-per-share exchange rate */
  exchangeRate: number;
  /** Total vault TVL in EURC (UI amount) */
  tvl: number;
  /** Whether data comes from on-chain */
  isLive: boolean;
}

const EMPTY: VaultSnapshot = {
  eurcBalance: 0,
  userShares: 0,
  exchangeRate: 1,
  tvl: 0,
  isLive: false,
};

function findAta(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

/**
 * Fetches on-chain vault state (balances, exchange rate, TVL).
 * Returns zeros when vault isn't deployed or wallet isn't connected.
 * Auto-refreshes when wallet connects/disconnects.
 */
export function useVaultState(): VaultSnapshot & { loading: boolean; error: string | null; refetch: () => void } {
  const { connection } = useConnection();
  const { connected, publicKey } = useWallet();
  const [snapshot, setSnapshot] = useState<VaultSnapshot>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isVaultLive = Boolean(VAULT_ADDRESS);

  const fetchState = useCallback(async () => {
    if (!isVaultLive || !connected || !publicKey) {
      setSnapshot(EMPTY);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const client = new VoltrClient(connection);
      const vaultPubkey = new PublicKey(VAULT_ADDRESS);
      const { vaultLpMint } = client.findVaultAddresses(vaultPubkey);

      const eurcAta = findAta(publicKey, EURC_MINT);
      const lpAta = findAta(publicKey, vaultLpMint);

      // Parallel fetch: user balances + vault TVL + LP supply
      const [eurcInfo, lpInfo, positionData, lpMintInfo] = await Promise.all([
        connection.getTokenAccountBalance(eurcAta).catch(() => null),
        connection.getTokenAccountBalance(lpAta).catch(() => null),
        client.getPositionAndTotalValuesForVault(vaultPubkey).catch(() => null),
        connection.getTokenSupply(vaultLpMint).catch(() => null),
      ]);

      const eurcBalance = eurcInfo ? parseFloat(eurcInfo.value.uiAmountString ?? '0') : 0;
      const userShares = lpInfo ? parseFloat(lpInfo.value.uiAmountString ?? '0') : 0;

      // Exchange rate = total vault EURC / total LP supply
      let exchangeRate = 1;
      let tvl = 0;

      if (positionData?.totalValue) {
        const totalValueAtoms = typeof positionData.totalValue.toNumber === 'function'
          ? positionData.totalValue.toNumber()
          : Number(positionData.totalValue);
        tvl = totalValueAtoms / EURC_PRECISION;

        const lpSupply = lpMintInfo ? parseFloat(lpMintInfo.value.uiAmountString ?? '0') : 0;
        if (lpSupply > 0) {
          exchangeRate = tvl / lpSupply;
        }
      }

      setSnapshot({ eurcBalance, userShares, exchangeRate, tvl, isLive: true });
      setError(null);
    } catch (err) {
      setSnapshot(EMPTY);
      const msg =
        err instanceof Error ? err.message : 'Unknown error loading vault data';
      setError(
        msg.includes('403') || msg.includes('429')
          ? 'RPC rate limit reached — try again in a few seconds'
          : msg.includes('fetch') || msg.includes('network') || msg.includes('ECONNREFUSED')
            ? 'Network error — check your connection and RPC endpoint'
            : `Failed to fetch vault state: ${msg}`,
      );
    } finally {
      setLoading(false);
    }
  }, [connection, connected, publicKey, isVaultLive]);

  useEffect(() => {
    void fetchState();
  }, [fetchState]);

  return { ...snapshot, loading, error, refetch: fetchState };
}
