import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { WalletProvider } from '@/providers/WalletProvider';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { FirebaseAuthProvider } from '@/providers/FirebaseAuthProvider';
import { VaultClientProvider } from '@/providers/VaultClientProvider';
import { ToastProvider } from '@/providers/ToastProvider';
import { ToastContainer } from '@/components/shared/ToastContainer';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { MotionConfigProvider } from '@/components/motion/MotionConfigProvider';
import { RouteProgressProvider } from '@/providers/RouteProgressProvider';
import { RouteProgressBar } from '@/components/layout/RouteProgressBar';

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
          <MotionConfigProvider>
            <WalletProvider>
              <FirebaseAuthProvider>
              <VaultClientProvider>
                <ToastProvider>
                  <RouteProgressProvider>
                    <ErrorBoundary>
                      <RouteProgressBar />
                      <AppShell>{children}</AppShell>
                    </ErrorBoundary>
                  </RouteProgressProvider>
                  <ToastContainer />
                </ToastProvider>
              </VaultClientProvider>
              </FirebaseAuthProvider>
            </WalletProvider>
          </MotionConfigProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
