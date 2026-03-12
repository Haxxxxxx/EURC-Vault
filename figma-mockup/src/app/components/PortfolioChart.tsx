import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { GlassCard } from './GlassCard';
import { useState } from 'react';

const portfolioData = [
  { date: 'Jan 1', total: 95000, staked: 60000, rewards: 3500 },
  { date: 'Jan 8', total: 96200, staked: 61000, rewards: 3680 },
  { date: 'Jan 15', total: 95800, staked: 60500, rewards: 3820 },
  { date: 'Jan 22', total: 97500, staked: 62000, rewards: 3980 },
  { date: 'Jan 29', total: 98200, staked: 62500, rewards: 4150 },
  { date: 'Feb 1', total: 99800, staked: 64000, rewards: 4320 },
  { date: 'Feb 5', total: 101200, staked: 64800, rewards: 4480 },
  { date: 'Feb 8', total: 103500, staked: 65200, rewards: 4567 },
  { date: 'Feb 10', total: 105234, staked: 65234, rewards: 4567 },
];

export function PortfolioChart() {
  const [timeRange, setTimeRange] = useState<'7D' | '1M' | '3M' | 'ALL'>('1M');

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card/95 backdrop-blur-xl border border-border rounded-xl p-4 shadow-xl">
          <p className="text-sm text-muted-foreground mb-2">{payload[0].payload.date}</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm">Total Balance:</span>
              <span className="font-medium">€{payload[0].value.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-primary">Staked:</span>
              <span className="font-medium text-primary">€{payload[1].value.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-accent">Rewards:</span>
              <span className="font-medium text-accent">€{payload[2].value.toLocaleString()}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-medium mb-1">Portfolio Evolution</h3>
          <p className="text-sm text-muted-foreground">Track your balance growth over time</p>
        </div>
        <div className="flex gap-2 p-1 bg-muted rounded-lg">
          {(['7D', '1M', '3M', 'ALL'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                timeRange === range
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={portfolioData}>
          <defs>
            <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--foreground)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="var(--foreground)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="stakedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="rewardsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
          <XAxis 
            dataKey="date" 
            stroke="var(--muted-foreground)" 
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            stroke="var(--muted-foreground)" 
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `€${(value / 1000).toFixed(0)}K`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="top" 
            height={36}
            iconType="circle"
            wrapperStyle={{ paddingBottom: '20px' }}
          />
          <Area
            type="monotone"
            dataKey="total"
            name="Total Balance"
            stroke="var(--foreground)"
            strokeWidth={2}
            fill="url(#totalGradient)"
          />
          <Area
            type="monotone"
            dataKey="staked"
            name="Staked"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#stakedGradient)"
          />
          <Area
            type="monotone"
            dataKey="rewards"
            name="Rewards"
            stroke="var(--chart-2)"
            strokeWidth={2}
            fill="url(#rewardsGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-border">
        <div>
          <div className="text-sm text-muted-foreground mb-1">Total Growth</div>
          <div className="text-xl font-light text-accent">+10.8%</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground mb-1">Best Day</div>
          <div className="text-xl font-light">+2,300 EURC</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground mb-1">Avg. Daily</div>
          <div className="text-xl font-light">+285 EURC</div>
        </div>
      </div>
    </GlassCard>
  );
}
