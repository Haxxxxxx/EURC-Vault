'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useTheme } from 'next-themes';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { truncateAddress } from '@/lib/utils';
import { NETWORK, RPC_ENDPOINTS } from '@/lib/constants';
import { Wallet, Network, Server, Moon, Sun, ExternalLink } from 'lucide-react';

export default function SettingsPage() {
  const { publicKey, connected, disconnect } = useWallet();
  const { theme, setTheme } = useTheme();
  const [network] = useState(NETWORK);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-light text-foreground mb-2">Settings</h1>
        <p className="text-foreground-secondary font-light">
          Manage your wallet connection and preferences
        </p>
      </div>

      <div className="max-w-3xl space-y-6">
        <GlassCard padding="lg">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10">
                <Wallet className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-medium text-foreground mb-1">Wallet Connection</h2>
                <p className="text-sm font-light text-foreground-secondary">
                  Your connected Solana wallet
                </p>
              </div>
            </div>
            {connected && (
              <Badge variant="success">Connected</Badge>
            )}
          </div>

          {connected && publicKey ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-glass border border-glass-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-light text-foreground-secondary mb-1">
                      Wallet Address
                    </p>
                    <p className="text-base font-medium text-foreground font-mono">
                      {truncateAddress(publicKey.toBase58(), 8, 8)}
                    </p>
                  </div>
                  <a
                    href={`https://solscan.io/account/${publicKey.toBase58()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary-hover transition-colors"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </a>
                </div>
              </div>

              <Button variant="danger" onClick={disconnect}>
                Disconnect Wallet
              </Button>
            </div>
          ) : (
            <p className="text-foreground-secondary font-light">
              No wallet connected. Use the button in the top bar to connect.
            </p>
          )}
        </GlassCard>

        <GlassCard padding="lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-xl bg-primary/10">
              <Network className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-medium text-foreground mb-1">Network</h2>
              <p className="text-sm font-light text-foreground-secondary">
                Current Solana network configuration
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-glass border border-glass-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-light text-foreground-secondary">
                  Active Network
                </span>
                <Badge variant={network === 'mainnet' ? 'success' : 'warning'}>
                  {network.toUpperCase()}
                </Badge>
              </div>
              <p className="text-sm font-light text-foreground-secondary">
                {network === 'mainnet'
                  ? 'Connected to Solana mainnet for production use'
                  : 'Connected to devnet for testing'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-glass border border-glass-border">
              <div className="flex items-start gap-3">
                <Server className="w-5 h-5 text-foreground-secondary mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-light text-foreground-secondary mb-1">
                    RPC Endpoint
                  </p>
                  <p className="text-sm font-medium text-foreground break-all">
                    {RPC_ENDPOINTS[network]}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard padding="lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-xl bg-primary/10">
              {theme === 'dark' ? (
                <Moon className="w-6 h-6 text-primary" />
              ) : (
                <Sun className="w-6 h-6 text-primary" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-medium text-foreground mb-1">Appearance</h2>
              <p className="text-sm font-light text-foreground-secondary">
                Choose your preferred theme
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setTheme('light')}
              className={`p-4 rounded-xl border-2 transition-all ${
                theme === 'light'
                  ? 'border-primary bg-primary/5'
                  : 'border-glass-border bg-glass hover:border-glass-border/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Sun className="w-5 h-5" />
                <span className="font-medium">Light</span>
              </div>
            </button>

            <button
              onClick={() => setTheme('dark')}
              className={`p-4 rounded-xl border-2 transition-all ${
                theme === 'dark'
                  ? 'border-primary bg-primary/5'
                  : 'border-glass-border bg-glass hover:border-glass-border/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Moon className="w-5 h-5" />
                <span className="font-medium">Dark</span>
              </div>
            </button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
