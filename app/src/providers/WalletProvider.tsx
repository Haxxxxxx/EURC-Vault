'use client';

import { useMemo, ReactNode } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { RPC_ENDPOINTS, NETWORK } from '@/lib/constants';

require('@solana/wallet-adapter-react-ui/styles.css');

interface WalletProviderProps {
  children: ReactNode;
}

// Empty array — Phantom, Solflare, etc. are auto-detected via wallet-standard
const wallets: never[] = [];

export function WalletProvider({ children }: WalletProviderProps) {
  const endpoint = useMemo(() => RPC_ENDPOINTS[NETWORK], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
