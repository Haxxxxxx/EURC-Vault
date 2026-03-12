'use client';

import { Sun, Moon, List } from '@phosphor-icons/react';
import { useTheme } from 'next-themes';
import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { EpochCountdown } from '@/components/shared/EpochCountdown';
import { NotificationBell } from '@/components/shared/NotificationBell';
import { DevnetFaucet } from '@/components/shared/DevnetFaucet';
import { WalletButton } from '@/components/shared/WalletButton';

interface TopBarProps {
  onMenuToggle?: () => void;
}

export function TopBar({ onMenuToggle }: TopBarProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleScroll = useCallback(() => {
    setScrolled(window.scrollY > 10);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return (
    <header className={cn(
      'h-20 border-b border-border flex items-center justify-between px-4 md:px-6 sticky top-0 z-50 transition-all duration-300',
      scrolled
        ? 'bg-background/80 backdrop-blur-xl shadow-md'
        : 'bg-card/50 backdrop-blur-sm'
    )}>
      <div className="flex items-center gap-4">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl hover:bg-muted/60 transition-colors"
            aria-label="Toggle menu"
          >
            <List className="w-5 h-5 text-foreground" weight="bold" />
          </button>
        )}
        <h1 className="text-xl md:text-2xl font-medium tracking-tight text-foreground">EURC Vault</h1>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <div className="hidden sm:block">
          <EpochCountdown />
        </div>

        <NotificationBell />

        <DevnetFaucet />

        {mounted ? (
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-muted-foreground" />
            ) : (
              <Moon className="w-5 h-5 text-muted-foreground" />
            )}
          </button>
        ) : (
          <div className="w-10 h-10 rounded-xl bg-muted" />
        )}

        <WalletButton />
      </div>
    </header>
  );
}
