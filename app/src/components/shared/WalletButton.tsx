'use client';

import dynamic from 'next/dynamic';

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then((mod) => mod.WalletMultiButton),
  { ssr: false, loading: () => <div className="h-10 w-36 rounded-xl bg-muted animate-pulse" /> },
);

export function WalletButton() {
  return (
    <div className="relative">
      <WalletMultiButton
        className="!bg-gradient-to-r !from-primary !to-primary/80 !text-primary-foreground !rounded-xl !px-6 !py-2.5 !font-medium hover:!shadow-lg hover:!scale-105 !transition-all !duration-200"
      />
    </div>
  );
}
