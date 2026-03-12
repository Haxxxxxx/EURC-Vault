import { GlassCard } from '../components/GlassCard';
import { Bell, ShieldCheck, Wallet, Globe, Envelope, Key } from '@phosphor-icons/react';

export function Settings() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-light mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your account preferences and security</p>
      </div>

      <GlassCard className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium">Wallet Connection</h3>
            <p className="text-sm text-muted-foreground">Manage your connected wallet</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Connected Wallet</div>
              <div className="font-mono text-sm">0x742d...4e5f</div>
            </div>
            <button className="px-4 py-2 border border-border rounded-lg font-medium hover:bg-muted transition-colors">
              Disconnect
            </button>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
            <Bell className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="font-medium">Notifications</h3>
            <p className="text-sm text-muted-foreground">Configure your notification preferences</p>
          </div>
        </div>

        <div className="space-y-4">
          {[
            { label: 'Epoch completion alerts', description: 'Get notified when an epoch ends' },
            { label: 'Reward distribution', description: 'Receive updates on reward payouts' },
            { label: 'Transaction confirmations', description: 'Get notified of successful transactions' },
            { label: 'Security alerts', description: 'Important security notifications' },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
              <div>
                <div className="font-medium mb-0.5">{item.label}</div>
                <div className="text-sm text-muted-foreground">{item.description}</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
              </label>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-chart-3/20 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-[var(--chart-3)]" />
          </div>
          <div>
            <h3 className="font-medium">Security</h3>
            <p className="text-sm text-muted-foreground">Enhance your account security</p>
          </div>
        </div>

        <div className="space-y-3">
          <button className="w-full flex items-center justify-between p-4 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <Key className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium">Two-Factor Authentication</span>
            </div>
            <span className="px-3 py-1 text-xs rounded-full bg-accent/20 text-accent">Enabled</span>
          </button>

          <button className="w-full flex items-center justify-between p-4 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <Envelope className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium">Email Verification</span>
            </div>
            <span className="px-3 py-1 text-xs rounded-full bg-accent/20 text-accent">Verified</span>
          </button>
        </div>
      </GlassCard>

      <GlassCard className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
            <Globe className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-medium">Preferences</h3>
            <p className="text-sm text-muted-foreground">Customize your experience</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
            <div>
              <div className="font-medium mb-0.5">Language</div>
              <div className="text-sm text-muted-foreground">Choose your preferred language</div>
            </div>
            <select className="px-4 py-2 bg-background border border-border rounded-lg font-medium">
              <option>English</option>
              <option>Français</option>
              <option>Deutsch</option>
              <option>Español</option>
            </select>
          </div>

          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
            <div>
              <div className="font-medium mb-0.5">Currency Display</div>
              <div className="text-sm text-muted-foreground">Primary currency for display</div>
            </div>
            <select className="px-4 py-2 bg-background border border-border rounded-lg font-medium">
              <option>EUR (€)</option>
              <option>USD ($)</option>
              <option>GBP (£)</option>
            </select>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}