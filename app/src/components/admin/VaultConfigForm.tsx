'use client';

import { useState } from 'react';
import { useUpdateVaultConfig } from '@/hooks/useUpdateVaultConfig';
import { useTogglePause } from '@/hooks/useTogglePause';
import { useAllVaultsAdmin, AdminVaultData } from '@/hooks/useAllVaultsAdmin';
import { VAULT_REGISTRY } from '@/lib/constants';
import { parseEurc, formatEurcDisplay } from '@/lib/utils';
import { Spinner, Pause, Play, FloppyDisk } from '@phosphor-icons/react';

export function VaultConfigForm() {
  const { vaults, loading: vaultsLoading } = useAllVaultsAdmin();
  const { updateConfig, loading: configLoading } = useUpdateVaultConfig();
  const { togglePause, loading: pauseLoading } = useTogglePause();
  const [selectedVaultId, setSelectedVaultId] = useState(VAULT_REGISTRY[0].onChainId);

  const vault = vaults.find((v) => v.onChainId === selectedVaultId);

  return (
    <div className="space-y-6">
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

      {vault && (
        <VaultConfigEditor
          vault={vault}
          onSave={updateConfig}
          onTogglePause={() => togglePause(vault.onChainId)}
          configLoading={configLoading}
          pauseLoading={pauseLoading}
        />
      )}
    </div>
  );
}

function VaultConfigEditor({
  vault,
  onSave,
  onTogglePause,
  configLoading,
  pauseLoading,
}: {
  vault: AdminVaultData;
  onSave: (vaultId: number, params: { newMaxCapacity?: number; newEpochDuration?: number; newWithdrawalCooldown?: number }) => Promise<string | null>;
  onTogglePause: () => void;
  configLoading: boolean;
  pauseLoading: boolean;
}) {
  const [maxCapacity, setMaxCapacity] = useState(
    (vault.capacity / 1_000_000).toString(),
  );
  const [epochDuration, setEpochDuration] = useState(
    (vault.epochDuration / 3600).toString(),
  );
  const [withdrawalCooldown, setWithdrawalCooldown] = useState(
    (vault.withdrawalCooldown / 3600).toString(),
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const params: { newMaxCapacity?: number; newEpochDuration?: number; newWithdrawalCooldown?: number } = {};

    const newCap = parseFloat(maxCapacity) * 1_000_000;
    if (newCap !== vault.capacity) params.newMaxCapacity = newCap;

    const newEpoch = parseFloat(epochDuration) * 3600;
    if (newEpoch !== vault.epochDuration) params.newEpochDuration = newEpoch;

    const newCooldown = parseFloat(withdrawalCooldown) * 3600;
    if (newCooldown !== vault.withdrawalCooldown) params.newWithdrawalCooldown = newCooldown;

    if (Object.keys(params).length === 0) return;
    await onSave(vault.onChainId, params);
  };

  return (
    <div className="space-y-5">
      {/* Pause toggle */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/30">
        <div>
          <p className="text-sm font-medium text-foreground">Vault Status</p>
          <p className="text-xs text-foreground-secondary">
            {vault.paused ? 'Deposits and withdrawals are paused' : 'Vault is accepting deposits'}
          </p>
        </div>
        <button
          onClick={onTogglePause}
          disabled={pauseLoading}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            vault.paused
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'bg-red-600 text-white hover:bg-red-700'
          } disabled:opacity-50`}
        >
          {pauseLoading ? (
            <Spinner className="w-3.5 h-3.5 animate-spin" />
          ) : vault.paused ? (
            <Play className="w-3.5 h-3.5" weight="bold" />
          ) : (
            <Pause className="w-3.5 h-3.5" weight="bold" />
          )}
          {vault.paused ? 'Resume' : 'Pause'}
        </button>
      </div>

      {/* Config form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <ConfigField
          label="Max Capacity (EURC)"
          value={maxCapacity}
          onChange={setMaxCapacity}
          hint={`Current: ${formatEurcDisplay(vault.capacity)} EURC`}
          type="number"
          step="0.01"
        />
        <ConfigField
          label="Epoch Duration (hours)"
          value={epochDuration}
          onChange={setEpochDuration}
          hint={`Current: ${vault.epochDuration / 3600} hours`}
          type="number"
          step="0.5"
        />
        <ConfigField
          label="Withdrawal Cooldown (hours)"
          value={withdrawalCooldown}
          onChange={setWithdrawalCooldown}
          hint={`Current: ${vault.withdrawalCooldown / 3600} hours`}
          type="number"
          step="0.5"
        />

        <button
          type="submit"
          disabled={configLoading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50"
        >
          {configLoading ? (
            <Spinner className="w-4 h-4 animate-spin" />
          ) : (
            <FloppyDisk className="w-4 h-4" weight="bold" />
          )}
          Save Configuration
        </button>
      </form>
    </div>
  );
}

function ConfigField({
  label,
  value,
  onChange,
  hint,
  type = 'text',
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint: string;
  type?: string;
  step?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground-secondary">{label}</label>
      <input
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
      <p className="text-[10px] text-foreground-secondary">{hint}</p>
    </div>
  );
}
