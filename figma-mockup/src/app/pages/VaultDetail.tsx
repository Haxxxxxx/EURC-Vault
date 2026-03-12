import { useParams, Link } from 'react-router';
import { GlassCard } from '../components/GlassCard';
import { Lock, TrendUp, ShieldCheck, Clock, Users, ChartLine, ArrowLeft } from '@phosphor-icons/react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const vaultData: Record<string, any> = {
  'main-stability': {
    name: 'Main EURC Stability Vault',
    apy: 8.45,
    tvl: 6500000,
    capacity: 10000000,
    risk: 'Low',
    lockPeriod: 'None',
    minDeposit: 100,
    description: 'Our flagship vault offering competitive APY with maximum flexibility. No lock-up periods and instant withdrawals.',
  },
  'high-yield': {
    name: 'High Yield EURC Pool',
    apy: 12.8,
    tvl: 3200000,
    capacity: 5000000,
    risk: 'Medium',
    lockPeriod: '7 days',
    minDeposit: 500,
    description: 'Enhanced returns for users willing to commit their EURC for a minimum period. Higher APY with moderate risk.',
  },
  'premium-locked': {
    name: 'Premium Locked Staking',
    apy: 15.5,
    tvl: 1800000,
    capacity: 3000000,
    risk: 'Medium',
    lockPeriod: '30 days',
    minDeposit: 1000,
    description: 'Maximum returns for committed stakers. 30-day lock period ensures stability and highest APY.',
  },
  'conservative': {
    name: 'Conservative Reserve Vault',
    apy: 5.2,
    tvl: 8900000,
    capacity: 15000000,
    risk: 'Very Low',
    lockPeriod: 'None',
    minDeposit: 50,
    description: 'Ultra-safe vault with conservative strategies. Perfect for risk-averse users seeking steady returns.',
  },
};

const apyHistoryData = [
  { date: 'Jan 1', apy: 7.2 },
  { date: 'Jan 8', apy: 7.8 },
  { date: 'Jan 15', apy: 8.1 },
  { date: 'Jan 22', apy: 8.3 },
  { date: 'Jan 29', apy: 8.0 },
  { date: 'Feb 5', apy: 8.5 },
  { date: 'Feb 10', apy: 8.45 },
];

const tvlHistoryData = [
  { date: 'Jan', tvl: 4200 },
  { date: 'Jan', tvl: 4800 },
  { date: 'Jan', tvl: 5200 },
  { date: 'Feb', tvl: 5800 },
  { date: 'Feb', tvl: 6100 },
  { date: 'Feb', tvl: 6500 },
];

export function VaultDetail() {
  const { vaultId } = useParams();
  const vault = vaultData[vaultId || 'main-stability'];

  if (!vault) {
    return <div>Vault not found</div>;
  }

  const percentFilled = (vault.tvl / vault.capacity) * 100;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <Link to="/vaults" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Vaults
      </Link>

      {/* Header */}
      <GlassCard className="p-8">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
              <Lock className="w-8 h-8 text-primary" weight="duotone" />
            </div>
            <div>
              <h1 className="text-3xl font-light mb-2">{vault.name}</h1>
              <p className="text-muted-foreground">{vault.description}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground mb-1">Current APY</div>
            <div className="text-5xl font-light text-accent">
              {vault.apy}<span className="text-3xl">%</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6">
          <div>
            <div className="text-sm text-muted-foreground mb-1">Total Value Locked</div>
            <div className="text-2xl font-light">€{(vault.tvl / 1000000).toFixed(1)}M</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Lock Period</div>
            <div className="text-2xl font-light">{vault.lockPeriod}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Min. Deposit</div>
            <div className="text-2xl font-light">{vault.minDeposit} EURC</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Risk Level</div>
            <div className="text-2xl font-light">{vault.risk}</div>
          </div>
        </div>
      </GlassCard>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <GlassCard className="p-6">
          <h3 className="text-lg font-medium mb-6 flex items-center gap-2">
            <ChartLine className="w-5 h-5 text-primary" />
            APY History
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={apyHistoryData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                }}
              />
              <Line
                type="monotone"
                dataKey="apy"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={{ fill: 'var(--chart-1)', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className="p-6">
          <h3 className="text-lg font-medium mb-6 flex items-center gap-2">
            <TrendUp className="w-5 h-5 text-accent" />
            TVL Growth
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={tvlHistoryData}>
              <defs>
                <linearGradient id="tvlGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                }}
              />
              <Area
                type="monotone"
                dataKey="tvl"
                stroke="var(--chart-2)"
                strokeWidth={2}
                fill="url(#tvlGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      {/* Stats & Info */}
      <div className="grid lg:grid-cols-3 gap-6">
        <GlassCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary" weight="duotone" />
            </div>
            <h3 className="font-medium">Security</h3>
          </div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-accent" />
              Audited by CertiK & Trail of Bits
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-accent" />
              Multi-sig wallet protection
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-accent" />
              Insurance coverage available
            </li>
          </ul>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-accent" weight="duotone" />
            </div>
            <h3 className="font-medium">Rewards</h3>
          </div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-accent" />
              Distributed every 7 days
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-accent" />
              Automatically compounded
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-accent" />
              Claim anytime after epoch
            </li>
          </ul>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-chart-3/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-[var(--chart-3)]" weight="duotone" />
            </div>
            <h3 className="font-medium">Community</h3>
          </div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-accent" />
              1,234 active stakers
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-accent" />
              Average stake: €5,263
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-accent" />
              Join our Discord community
            </li>
          </ul>
        </GlassCard>
      </div>

      {/* Capacity Bar */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium">Vault Capacity</h3>
          <span className="text-sm text-muted-foreground">
            {vault.tvl.toLocaleString()} / {vault.capacity.toLocaleString()} EURC
          </span>
        </div>
        <div className="relative h-3 bg-muted rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-accent rounded-full"
            style={{ width: `${percentFilled}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-sm">
          <span className="text-accent font-medium">{percentFilled.toFixed(1)}% Filled</span>
          <span className="text-muted-foreground">
            {(vault.capacity - vault.tvl).toLocaleString()} EURC Available
          </span>
        </div>
      </GlassCard>

      {/* CTA */}
      <div className="flex gap-4">
        <Link
          to={`/deposit-withdraw/${vaultId}`}
          className="flex-1 h-14 bg-gradient-to-r from-primary to-accent text-white font-medium rounded-xl hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center text-lg"
        >
          Start Staking
        </Link>
        <button className="px-8 h-14 border border-border rounded-xl font-medium hover:bg-muted transition-colors">
          Read Documentation
        </button>
      </div>
    </div>
  );
}