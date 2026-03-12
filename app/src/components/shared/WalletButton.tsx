'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { truncateAddress } from '@/lib/utils';
import { Wallet } from 'lucide-react';

export function WalletButton() {
  const { publicKey, connected } = useWallet();

  return (
    <div className="relative">
      <WalletMultiButton
        className="!bg-glass !backdrop-blur-glass !border !border-glass-border !rounded-xl !px-6 !py-3 !text-foreground hover:!bg-white/10 !transition-all !duration-200 !shadow-glass hover:!shadow-glass-hover"
      >
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4" />
          <span className="font-medium">
            {connected && publicKey
              ? truncateAddress(publicKey.toBase58())
              : 'Connect Wallet'}
          </span>
        </div>
      </WalletMultiButton>
    </div>
  );
}
