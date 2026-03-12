'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useVaults, VaultData } from '@/hooks/useVault';
import { useUserStake } from '@/hooks/useUserStake';
import { formatEurcDisplay, formatPercentage } from '@/lib/utils';
import { VAULT_REGISTRY } from '@/lib/constants';
import Link from 'next/link';
import { ArrowRight, Vault } from '@phosphor-icons/react';

export function ActivePositionsList() {
  const { connected } = useWallet();
  const { vaults, loading } = useVaults();

  if (!connected || loading) return null;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Your Positions</h3>
      </div>
      <div className="divide-y divide-border/50">
        {VAULT_REGISTRY.map((entry) => (
          <PositionRow key={entry.slug} slug={entry.slug} vaults={vaults} />
        ))}
      </div>
    </div>
  );
}

function PositionRow({ slug, vaults }: { slug: string; vaults: VaultData[] }) {
  const { stake } = useUserStake(slug);
  const vault = vaults.find((v) => v.slug === slug);

  const positionValue = stake?.positionValueEurc ?? 0;
  const hasPosition = positionValue > 0;

  if (!vault) return null;

  return (
    <div className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Vault className="w-4 h-4 text-primary" weight="duotone" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{vault.name}</p>
          <p className="text-[10px] text-foreground-secondary">
            APY: {formatPercentage(vault.apy)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {hasPosition ? (
          <>
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">
                {formatEurcDisplay(positionValue)} EURC
              </p>
            </div>
            <Link
              href={`/deposit-withdraw/${slug}`}
              className="p-1.5 rounded-lg text-foreground-secondary hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <ArrowRight className="w-4 h-4" weight="bold" />
            </Link>
          </>
        ) : (
          <Link
            href={`/deposit-withdraw/${slug}`}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            Deposit
          </Link>
        )}
      </div>
    </div>
  );
}
