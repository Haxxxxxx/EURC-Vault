'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useFirebaseAuth } from '@/hooks/useFirebaseAuth';
import { X, Fingerprint } from '@phosphor-icons/react';

export function SiwsBanner() {
  const { connected } = useWallet();
  const { isAuthenticated, loading, signIn } = useFirebaseAuth();
  const [dismissed, setDismissed] = useState(false);

  if (!connected || isAuthenticated || dismissed) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 border border-primary/20 mb-4">
      <Fingerprint className="w-5 h-5 text-primary flex-shrink-0" weight="duotone" />
      <p className="text-sm font-light text-foreground-secondary flex-1">
        Sign in to unlock history, leaderboard, and notifications
      </p>
      <button
        onClick={signIn}
        disabled={loading}
        className="px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-primary hover:bg-primary-hover transition-colors disabled:opacity-50 flex-shrink-0"
      >
        {loading ? 'Signing...' : 'Sign In'}
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 rounded-lg text-foreground-secondary hover:text-foreground hover:bg-white/5 transition-colors flex-shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" weight="bold" />
      </button>
    </div>
  );
}
