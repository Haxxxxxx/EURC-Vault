import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { WalletProvider } from '@/providers/WalletProvider';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'EURC Yield Optimizer | Ranger Earn',
  description: 'Maximize EURC yield through automated cross-protocol rate arbitrage across Drift, Kamino, and Save. Target 12-15% APY.',
  openGraph: {
    title: 'EURC Yield Optimizer | Ranger Earn',
    description: 'Automated EURC yield optimization — 12-15% APY target through cross-protocol rate arbitrage.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground`}>
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
