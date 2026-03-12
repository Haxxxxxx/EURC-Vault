'use client';

import { ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { ShieldSlash, Spinner, Wallet } from '@phosphor-icons/react';
import { WalletButton } from '@/components/shared/WalletButton';

interface AdminGateProps {
  children: ReactNode;
}

export function AdminGate({ children }: AdminGateProps) {
  const { connected } = useWallet();
  const { isAdmin, loading } = useAdminAuth();

  if (!connected) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Wallet className="w-8 h-8 text-primary" weight="duotone" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Connect Wallet</h2>
          <p className="text-sm text-foreground-secondary">
            Connect the vault authority wallet to access the admin panel.
          </p>
          <WalletButton />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <Spinner className="w-8 h-8 text-primary animate-spin mx-auto" />
          <p className="text-sm text-foreground-secondary">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto">
            <ShieldSlash className="w-8 h-8 text-red-500" weight="duotone" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Access Denied</h2>
          <p className="text-sm text-foreground-secondary">
            The connected wallet is not the authority for any vault. Switch to the vault authority wallet to access admin controls.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
