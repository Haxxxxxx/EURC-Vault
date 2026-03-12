'use client';

import { useState, useEffect, useCallback } from 'react';
import { useReadOnlyClient } from '@/providers/VaultClientProvider';
import { PROGRAM_ID } from '@/lib/constants';
import type { PublicKey } from '@solana/web3.js';
import type { BN } from '@coral-xyz/anchor';

export interface Participant {
  wallet: string;
  pendingWithdrawalEurc: number;
  pendingWithdrawalShares: number;
  withdrawalAvailableAt: number;
  firstDepositTime: number;
  lastInteractionTime: number;
}

/**
 * Fetch all UserStake accounts for a given vault using getProgramAccounts
 * with a memcmp filter on the vault field.
 */
export function useVaultParticipants(vaultId: number | null) {
  const readOnlyClient = useReadOnlyClient();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchParticipants = useCallback(async () => {
    if (vaultId === null || !readOnlyClient) {
      setParticipants([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Get the vault config PDA address for filtering
      const vaultConfigAddress = readOnlyClient.getVaultConfigAddress(vaultId);

      // Use getProgramAccounts with memcmp filter on the `vault` field
      // UserStake layout: 8 (discriminator) + 32 (vault) + 32 (user) + 1 (bump) + 8 (pendingWithdrawalEurc) + 8 (pendingWithdrawalShares) + 8 (withdrawalAvailableAt) + 8 (firstDepositTime) + 8 (lastInteractionTime)
      const accounts = await readOnlyClient.connection.getProgramAccounts(
        PROGRAM_ID,
        {
          filters: [
            { dataSize: 8 + 32 + 32 + 1 + 8 + 8 + 8 + 8 + 8 },
            {
              memcmp: {
                offset: 8, // After discriminator
                bytes: vaultConfigAddress.toBase58(),
              },
            },
          ],
        },
      );

      // Decode using the Anchor coder
      const decoded: Participant[] = [];
      for (const { account } of accounts) {
        try {
          const userStake = (readOnlyClient.program.coder.accounts as any).decode(
            'UserStake',
            account.data,
          );

          decoded.push({
            wallet: (userStake.user as PublicKey).toBase58(),
            pendingWithdrawalEurc: (userStake.pendingWithdrawalEurc as BN).toNumber(),
            pendingWithdrawalShares: (userStake.pendingWithdrawalShares as BN).toNumber(),
            withdrawalAvailableAt: (userStake.withdrawalAvailableAt as BN).toNumber(),
            firstDepositTime: (userStake.firstDepositTime as BN).toNumber(),
            lastInteractionTime: (userStake.lastInteractionTime as BN).toNumber(),
          });
        } catch {
          // Skip accounts that fail to decode
        }
      }

      // Sort by most recent interaction descending
      decoded.sort((a, b) => b.lastInteractionTime - a.lastInteractionTime);
      setParticipants(decoded);
    } catch {
      setParticipants([]);
    } finally {
      setLoading(false);
    }
  }, [vaultId, readOnlyClient]);

  useEffect(() => {
    fetchParticipants();
  }, [fetchParticipants]);

  return { participants, loading, refetch: fetchParticipants };
}
