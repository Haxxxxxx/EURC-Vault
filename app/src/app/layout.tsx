import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { WalletProvider } from '@/providers/WalletProvider';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { AppShell } from '@/components/layout/AppShell';

const inter = Inter({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'EURC Vault - Secure Staking on Solana',
  description: 'Premium fintech staking platform for EURC on Solana blockchain',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.variable}>
        <ThemeProvider>
          <WalletProvider>
            <AppShell>{children}</AppShell>
          </WalletProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
