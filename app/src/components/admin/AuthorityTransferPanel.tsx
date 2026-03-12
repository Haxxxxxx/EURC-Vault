'use client';

import { useState } from 'react';
import { useTransferAuthority } from '@/hooks/useTransferAuthority';
import { useAllVaultsAdmin } from '@/hooks/useAllVaultsAdmin';
import { VAULT_REGISTRY } from '@/lib/constants';
import { truncateAddress } from '@/lib/utils';
import { Spinner, ShieldCheck, ArrowRight, Warning } from '@phosphor-icons/react';
import { PublicKey } from '@solana/web3.js';

export function AuthorityTransferPanel() {
  const { initiateTransfer, loading } = useTransferAuthority();
  const { vaults } = useAllVaultsAdmin();
  const [selectedVaultId, setSelectedVaultId] = useState(VAULT_REGISTRY[0].onChainId);
  const [newAuthority, setNewAuthority] = useState('');

  const vault = vaults.find((v) => v.onChainId === selectedVaultId);

  const isValidAddress = (() => {
    if (!newAuthority) return false;
    try {
      new PublicKey(newAuthority);
      return true;
    } catch {
      return false;
    }
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidAddress) return;
    const sig = await initiateTransfer(selectedVaultId, newAuthority);
    if (sig) setNewAuthority('');
  };

  return (
    <div className="space-y-6">
      {/* Warning */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <Warning className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" weight="bold" />
        <div>
          <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
            Authority Transfer Warning
          </p>
          <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">
            Transferring vault authority is a 2-step process. After initiation, the new authority must
            call <code className="font-mono bg-amber-500/10 px-1 rounded">acceptAuthorityTransfer</code> to
            complete it. This action is irreversible once accepted.
          </p>
        </div>
      </div>

      {/* Current authority info */}
      {vault && vault.authority && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
          <p className="text-xs font-medium text-foreground-secondary">Current Authority</p>
          <p className="font-mono text-sm text-foreground">{truncateAddress(vault.authority, 8, 8)}</p>
        </div>
      )}

      {/* Transfer form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground-secondary">Select Vault</label>
          <select
            value={selectedVaultId}
            onChange={(e) => setSelectedVaultId(Number(e.target.value))}
            className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {VAULT_REGISTRY.map((v) => (
              <option key={v.onChainId} value={v.onChainId}>
                {v.name} (ID: {v.onChainId})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground-secondary">New Authority Address</label>
          <input
            type="text"
            placeholder="Enter Solana address..."
            value={newAuthority}
            onChange={(e) => setNewAuthority(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-sm text-foreground font-mono placeholder:text-foreground-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          {newAuthority && !isValidAddress && (
            <p className="text-[10px] text-red-500">Invalid Solana address</p>
          )}
        </div>

        {/* Preview */}
        {isValidAddress && vault?.authority && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border">
            <div className="text-xs">
              <p className="text-foreground-secondary">From</p>
              <p className="font-mono text-foreground">{truncateAddress(vault.authority, 6, 4)}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-foreground-secondary" />
            <div className="text-xs">
              <p className="text-foreground-secondary">To</p>
              <p className="font-mono text-foreground">{truncateAddress(newAuthority, 6, 4)}</p>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !isValidAddress}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Spinner className="w-4 h-4 animate-spin" />
          ) : (
            <ShieldCheck className="w-4 h-4" weight="bold" />
          )}
          Initiate Authority Transfer
        </button>
      </form>
    </div>
  );
}
