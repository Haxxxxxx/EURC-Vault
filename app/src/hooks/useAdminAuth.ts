'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useReadOnlyClient } from '@/providers/VaultClientProvider';
import { VAULT_REGISTRY } from '@/lib/constants';

/**
 * Checks if the connected wallet is the authority for any vault.
 * Returns the authority status and matching vault IDs.
 *
 * Security note: this is a UX-only gate. On-chain `has_one = authority`
 * enforces real access control — this just hides admin UI for non-admins.
 */
export function useAdminAuth() {
  const { publicKey, connected } = useWallet();
  const readOnlyClient = useReadOnlyClient();
  const [isAdmin, setIsAdmin] = useState(false);
  const [authorityVaultIds, setAuthorityVaultIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!connected || !publicKey || !readOnlyClient) {
      setIsAdmin(false);
      setAuthorityVaultIds([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function checkAuthority() {
      setLoading(true);
      const matchingIds: number[] = [];

      try {
        const results = await Promise.allSettled(
          VAULT_REGISTRY.map(async (entry) => {
            const config = await readOnlyClient!.getVaultConfigOrNull(entry.onChainId);
            if (config && config.authority.equals(publicKey!)) {
              return entry.onChainId;
            }
            return null;
          }),
        );

        if (controller.signal.aborted) return;

        for (const r of results) {
          if (r.status === 'fulfilled' && r.value !== null) {
            matchingIds.push(r.value);
          }
        }

        setAuthorityVaultIds(matchingIds);
        setIsAdmin(matchingIds.length > 0);
      } catch {
        if (!controller.signal.aborted) {
          setIsAdmin(false);
          setAuthorityVaultIds([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    checkAuthority();
    return () => controller.abort();
  }, [publicKey, connected, readOnlyClient]);

  return { isAdmin, authorityVaultIds, loading };
}
