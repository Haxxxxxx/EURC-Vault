import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { WalletProvider } from '@/providers/WalletProvider';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { ToastProvider } from '@/components/ui/Toast';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'EURC Yield Optimizer | Ranger Earn',
  description: 'Maximize EURC yield through automated cross-protocol rate arbitrage across Drift, Kamino, and Save on Solana.',
  keywords: ['EURC', 'yield', 'Solana', 'Ranger Earn', 'DeFi', 'vault', 'Drift', 'Kamino', 'Save'],
  openGraph: {
    title: 'EURC Yield Optimizer | Ranger Earn',
    description: 'Automated EURC yield optimization — cross-protocol rate arbitrage across Drift, Kamino, and Save on Solana.',
    type: 'website',
    siteName: 'Ranger Earn',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EURC Yield Optimizer | Ranger Earn',
    description: 'Automated EURC yield optimization — cross-protocol rate arbitrage on Solana.',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground`}>
        <WalletProvider>
          <ToastProvider>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </ToastProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
