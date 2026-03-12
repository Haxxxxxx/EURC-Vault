'use client';

import { useState, useMemo } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { FadeIn } from '@/components/motion/FadeIn';
import { usePortfolioHistory, useRewardsTimeline } from '@/hooks/useChartData';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const timeRanges = ['7D', '1M', '3M', 'ALL'] as const;
type TimeRange = (typeof timeRanges)[number];

const RANGE_DAYS: Record<TimeRange, number> = {
  '7D': 7,
  '1M': 30,
  '3M': 90,
  ALL: 180,
};

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-card/95 backdrop-blur-xl border border-border px-4 py-3 shadow-xl">
      <p className="text-xs font-light text-foreground-secondary mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-foreground-secondary capitalize">
              {entry.dataKey === 'total' ? 'Total' : entry.dataKey === 'staked' ? 'Staked' : 'Rewards'}
            </span>
          </div>
          <span className="font-medium text-foreground">
            {entry.value.toLocaleString('en-US')} EURC
          </span>
        </div>
      ))}
    </div>
  );
}

function CustomLegend() {
  const items = [
    { label: 'Total', color: 'var(--foreground)' },
    { label: 'Staked', color: 'var(--chart-1)' },
    { label: 'Rewards', color: 'var(--chart-2)' },
  ];

  return (
    <div className="flex items-center gap-5 mb-4">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-xs text-foreground-secondary">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function PortfolioChart() {
  const [range, setRange] = useState<TimeRange>('1M');
  const days = RANGE_DAYS[range];

  const portfolioData = usePortfolioHistory(days, 90000);
  const rewardsData = useRewardsTimeline(days, 15000);

  const chartData = useMemo(() => {
    return portfolioData.map((p, i) => {
      const rewards = rewardsData[i]?.value ?? 0;
      const total = Math.round(p.value);
      const staked = Math.round(total - rewards);
      return {
        date: p.date,
        total,
        staked,
        rewards: Math.round(rewards),
      };
    });
  }, [portfolioData, rewardsData]);

  const stats = useMemo(() => {
    if (chartData.length < 2)
      return { growthPct: 0, bestDay: 0, dailyAvg: 0 };

    const first = chartData[0].total;
    const last = chartData[chartData.length - 1].total;
    const growthPct = first > 0 ? ((last - first) / first) * 100 : 0;

    let bestDay = 0;
    const deltas: number[] = [];
    for (let i = 1; i < chartData.length; i++) {
      const delta = chartData[i].total - chartData[i - 1].total;
      deltas.push(delta);
      if (delta > bestDay) bestDay = delta;
    }
    const dailyAvg =
      deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;

    return { growthPct, bestDay, dailyAvg };
  }, [chartData]);

  return (
    <FadeIn>
      <GlassCard padding="md" className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div>
            <h3 className="text-lg font-medium text-foreground">Portfolio Evolution</h3>
            <p className="text-sm font-light text-foreground-secondary">Track your balance growth over time</p>
          </div>
          <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1">
            {timeRanges.map((tr) => (
              <button
                key={tr}
                onClick={() => setRange(tr)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                  range === tr
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-foreground-secondary hover:text-foreground'
                }`}
              >
                {tr}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <CustomLegend />

        {/* Chart */}
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="portfolioTotalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--foreground)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="var(--foreground)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="portfolioStakedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="portfolioRewardsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="var(--muted-foreground)"
                fontSize={11}
                fontWeight={300}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(value: number) => `\u20AC${(value / 1000).toFixed(0)}K`}
                stroke="var(--muted-foreground)"
                fontSize={11}
                fontWeight={300}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend content={() => null} />
              <Area
                type="monotone"
                dataKey="total"
                stroke="var(--foreground)"
                strokeWidth={2}
                fill="url(#portfolioTotalGrad)"
                animationDuration={1000}
                animationEasing="ease-out"
              />
              <Area
                type="monotone"
                dataKey="staked"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#portfolioStakedGrad)"
                animationDuration={1000}
                animationEasing="ease-out"
              />
              <Area
                type="monotone"
                dataKey="rewards"
                stroke="var(--chart-2)"
                strokeWidth={2}
                fill="url(#portfolioRewardsGrad)"
                animationDuration={1000}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Bottom Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-border">
          <div className="text-center">
            <p className="text-sm text-foreground-secondary mb-1">Total Growth</p>
            <p className="text-xl font-light text-accent">
              {stats.growthPct >= 0 ? '+' : ''}{stats.growthPct.toFixed(1)}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-foreground-secondary mb-1">Best Day</p>
            <p className="text-xl font-light text-foreground">
              +{stats.bestDay.toLocaleString('en-US')} EURC
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-foreground-secondary mb-1">Daily Average</p>
            <p className="text-xl font-light text-foreground">
              +{Math.round(stats.dailyAvg).toLocaleString('en-US')} EURC
            </p>
          </div>
        </div>
      </GlassCard>
    </FadeIn>
  );
}
