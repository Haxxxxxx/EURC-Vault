'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageTransition } from '@/components/motion/PageTransition';
import { StaggerGrid, StaggerItem } from '@/components/motion/StaggerGrid';
import { truncateAddress } from '@/lib/utils';
import { useUserPreferences, NotificationPreferences } from '@/hooks/useUserPreferences';
import {
  Wallet,
  Bell,
  ShieldCheck,
  Key,
  Envelope,
  Globe,
  ArrowSquareOut,
  SignOut,
} from '@phosphor-icons/react';

export default function SettingsPage() {
  const { publicKey, connected, disconnect } = useWallet();
  const { preferences, updatePreference, loading } = useUserPreferences();

  const toggleNotification = (key: keyof NotificationPreferences) => {
    updatePreference('notifications', {
      ...preferences.notifications,
      [key]: !preferences.notifications[key],
    });
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-light text-foreground mb-2">Settings</h1>
          <p className="text-foreground-secondary font-light">
            Manage your wallet, notifications, and preferences
          </p>
        </div>

        {loading ? (
          <div className="max-w-4xl space-y-6">
            {/* Wallet skeleton */}
            <Skeleton height="180px" rounded="lg" className="w-full" />
            {/* Notifications skeleton */}
            <Skeleton height="320px" rounded="lg" className="w-full" />
            {/* Security skeleton */}
            <Skeleton height="200px" rounded="lg" className="w-full" />
            {/* Preferences skeleton */}
            <Skeleton height="180px" rounded="lg" className="w-full" />
          </div>
        ) : (
        <StaggerGrid className="max-w-4xl space-y-6">
          {/* Wallet Connection */}
          <StaggerItem>
            <GlassCard padding="lg" className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-primary/20">
                    <Wallet className="w-6 h-6 text-primary" weight="duotone" />
                  </div>
                  <div>
                    <h2 className="text-xl font-medium text-foreground mb-1">Wallet Connection</h2>
                    <p className="text-sm font-light text-foreground-secondary">
                      Your connected Solana wallet
                    </p>
                  </div>
                </div>
                {connected && <Badge variant="success">Connected</Badge>}
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
                        <ArrowSquareOut className="w-5 h-5" weight="bold" />
                      </a>
                    </div>
                  </div>

                  <Button variant="danger" onClick={disconnect}>
                    <SignOut className="w-4 h-4" weight="bold" />
                    Disconnect Wallet
                  </Button>
                </div>
              ) : (
                <p className="text-foreground-secondary font-light">
                  No wallet connected. Use the button in the top bar to connect.
                </p>
              )}
            </GlassCard>
          </StaggerItem>

          {/* Notifications */}
          <StaggerItem>
            <GlassCard padding="lg" className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-accent/20">
                  <Bell className="w-6 h-6 text-accent" weight="duotone" />
                </div>
                <div>
                  <h2 className="text-xl font-medium text-foreground mb-1">Notifications</h2>
                  <p className="text-sm font-light text-foreground-secondary">
                    Choose which notifications you receive
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  {
                    key: 'epochAlerts' as const,
                    label: 'Epoch Alerts',
                    description: 'Get notified when a new epoch starts or ends',
                  },
                  {
                    key: 'rewardDistribution' as const,
                    label: 'Reward Distribution',
                    description: 'Notifications when rewards are distributed',
                  },
                  {
                    key: 'txConfirmations' as const,
                    label: 'Transaction Confirmations',
                    description: 'Confirm when deposits and withdrawals complete',
                  },
                  {
                    key: 'securityAlerts' as const,
                    label: 'Security Alerts',
                    description: 'Important security and account notifications',
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-4 rounded-xl bg-glass border border-glass-border"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs font-light text-foreground-secondary mt-0.5">
                        {item.description}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleNotification(item.key)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                        preferences.notifications[item.key] ? 'bg-primary' : 'bg-glass-border'
                      }`}
                      role="switch"
                      aria-checked={preferences.notifications[item.key]}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                          preferences.notifications[item.key] ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </GlassCard>
          </StaggerItem>

          {/* Security */}
          <StaggerItem>
            <GlassCard padding="lg" className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-chart-3/20">
                  <ShieldCheck className="w-6 h-6 text-[var(--chart-3)]" weight="duotone" />
                </div>
                <div>
                  <h2 className="text-xl font-medium text-foreground mb-1">Security</h2>
                  <p className="text-sm font-light text-foreground-secondary">
                    Account security settings
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-glass border border-glass-border">
                  <div className="flex items-center gap-3">
                    <Key className="w-5 h-5 text-foreground-secondary" weight="duotone" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Two-Factor Authentication</p>
                      <p className="text-xs font-light text-foreground-secondary mt-0.5">
                        Additional security layer for your account
                      </p>
                    </div>
                  </div>
                  <Badge variant="warning">Coming Soon</Badge>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-glass border border-glass-border">
                  <div className="flex items-center gap-3">
                    <Envelope className="w-5 h-5 text-foreground-secondary" weight="duotone" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Email Verification</p>
                      <p className="text-xs font-light text-foreground-secondary mt-0.5">
                        Verified email for account recovery
                      </p>
                    </div>
                  </div>
                  <Badge variant="warning">Coming Soon</Badge>
                </div>
              </div>
            </GlassCard>
          </StaggerItem>

          {/* Preferences */}
          <StaggerItem>
            <GlassCard padding="lg" className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-muted">
                  <Globe className="w-6 h-6 text-foreground-secondary" weight="duotone" />
                </div>
                <div>
                  <h2 className="text-xl font-medium text-foreground mb-1">Preferences</h2>
                  <p className="text-sm font-light text-foreground-secondary">
                    Display and locale settings
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-glass border border-glass-border">
                  <label className="text-sm font-medium text-foreground">Language</label>
                  <select
                    value={preferences.language}
                    onChange={(e) => updatePreference('language', e.target.value)}
                    className="w-48 px-4 py-2.5 rounded-xl bg-background border border-glass-border text-foreground text-sm font-light focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
                  >
                    <option value="en">English</option>
                    <option value="fr">Francais</option>
                    <option value="de">Deutsch</option>
                    <option value="es">Espanol</option>
                    <option value="pt">Portugues</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-glass border border-glass-border">
                  <label className="text-sm font-medium text-foreground">Currency Display</label>
                  <select
                    value={preferences.currency}
                    onChange={(e) => updatePreference('currency', e.target.value)}
                    className="w-48 px-4 py-2.5 rounded-xl bg-background border border-glass-border text-foreground text-sm font-light focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
                  >
                    <option value="EUR">EUR - Euro</option>
                    <option value="USD">USD - US Dollar</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="CHF">CHF - Swiss Franc</option>
                  </select>
                </div>
              </div>
            </GlassCard>
          </StaggerItem>
        </StaggerGrid>
        )}
      </div>
    </PageTransition>
  );
}
