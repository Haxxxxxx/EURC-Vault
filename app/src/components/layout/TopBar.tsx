'use client';

import { EpochCountdown } from '@/components/shared/EpochCountdown';
import { WalletButton } from '@/components/shared/WalletButton';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

export function TopBar() {
  return (
    <header className="fixed top-0 left-20 right-0 h-20 flex items-center justify-between px-8 bg-background/80 backdrop-blur-glass border-b border-glass-border z-30">
      <div>
        <h1 className="text-2xl font-light text-foreground">EURC Vault</h1>
        <p className="text-sm font-light text-foreground-secondary">
          Secure staking on Solana
        </p>
      </div>

      <div className="flex items-center gap-4">
        <EpochCountdown />
        <div className="h-8 w-px bg-glass-border" />
        <ThemeToggle />
        <WalletButton />
      </div>
    </header>
  );
}
