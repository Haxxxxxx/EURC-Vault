'use client';

import { useState } from 'react';
import { useFundRewards } from '@/hooks/useFundRewards';
import { VAULT_REGISTRY, EURC_DECIMALS } from '@/lib/constants';
import { formatEurcDisplay, parseEurc } from '@/lib/utils';
import { CurrencyEur, Spinner, ArrowRight } from '@phosphor-icons/react';

export function FundRewardsForm() {
  const { fundRewards, loading } = useFundRewards();
  const [selectedVaultId, setSelectedVaultId] = useState(VAULT_REGISTRY[0].onChainId);
  const [amount, setAmount] = useState('');

  const amountBaseUnits = amount ? parseEurc(amount) : 0;
  const selectedVault = VAULT_REGISTRY.find((v) => v.onChainId === selectedVaultId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amountBaseUnits <= 0) return;
    const sig = await fundRewards(selectedVaultId, amountBaseUnits);
    if (sig) setAmount('');
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Fund Rewards</h3>
        <p className="text-xs text-foreground-secondary mt-1">
          Transfer EURC from your wallet to the vault reward pool
        </p>
      </div>

      {/* Vault selector */}
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

      {/* Amount input */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground-secondary">Amount (EURC)</label>
        <div className="relative">
          <CurrencyEur className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-secondary" weight="bold" />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="1000.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-muted/50 border border-border text-sm text-foreground placeholder:text-foreground-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        {amountBaseUnits > 0 && (
          <p className="text-[10px] text-foreground-secondary">
            = {amountBaseUnits.toLocaleString()} base units
          </p>
        )}
      </div>

      {/* Preview */}
      {amountBaseUnits > 0 && selectedVault && (
        <div className="rounded-xl bg-muted/30 border border-border p-3 space-y-1">
          <p className="text-xs text-foreground-secondary">Transaction Preview</p>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-foreground font-medium">
              {formatEurcDisplay(amountBaseUnits)} EURC
            </span>
            <ArrowRight className="w-4 h-4 text-foreground-secondary" />
            <span className="text-foreground font-medium">{selectedVault.name}</span>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || amountBaseUnits <= 0}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Spinner className="w-4 h-4 animate-spin" />
            Processing...
          </>
        ) : (
          'Fund Rewards'
        )}
      </button>
    </form>
  );
}
