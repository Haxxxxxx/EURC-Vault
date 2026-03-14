'use client';

import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { MetricsPoint } from '@/hooks/useMetricsHistory';

interface CumulativeYieldChartProps {
  data: MetricsPoint[];
  depositEurc: number;
  loading: boolean;
}

interface CumulativePoint {
  timestamp: number;
  yieldEurc: number;
  bestSingleYield: number;
  tvlEurc: number;
}

/**
 * Derive cumulative yield from TVL history.
 * Compares blended strategy vs best single protocol.
 */
function buildCumulativeData(points: MetricsPoint[], depositEurc: number): CumulativePoint[] {
  if (points.length === 0) return [];

  const baseTvl = points[0].tvlEurc;
  if (baseTvl <= 0) return [];
  const scale = depositEurc / baseTvl;

  // Track cumulative yield from the best single protocol at each step
  let bestCumulativeYield = 0;

  const step = Math.max(1, Math.floor(points.length / 100));
  return points
    .filter((_, i) => i % step === 0)
    .map((p, idx) => {
      // Best single protocol APY at this point
      const bestApy = Math.max(p.driftApyPct, p.kaminoApyPct, p.saveApyPct);
      // Accrual covers `step` intervals of 15 min each = step/(365*96) of a year
      if (idx > 0) {
        bestCumulativeYield += (depositEurc + bestCumulativeYield) * (bestApy / 100) * step / (365 * 96);
      }

      return {
        timestamp: p.timestamp,
        tvlEurc: parseFloat((p.tvlEurc * scale).toFixed(2)),
        yieldEurc: parseFloat(Math.max(0, (p.tvlEurc - baseTvl) * scale).toFixed(4)),
        bestSingleYield: parseFloat(bestCumulativeYield.toFixed(4)),
      };
    });
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-lg text-xs space-y-1">
      <p className="text-muted-foreground mb-1">
        {new Date(label as number).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>
      {(payload as Array<{ name: string; value: number; color: string }>).map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}</span>
          </div>
          <span className="font-semibold tabular-nums" style={{ color: entry.color }}>
            {entry.value.toFixed(4)} EURC
          </span>
        </div>
      ))}
    </div>
  );
}

export function CumulativeYieldChart({
  data,
  depositEurc,
  loading,
}: CumulativeYieldChartProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="h-5 w-44 rounded bg-secondary animate-pulse mb-4" />
        <div className="h-52 w-full rounded-xl bg-secondary/30 animate-pulse" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground mb-2">Cumulative Yield</h2>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-muted-foreground">No yield data available yet</p>
        </div>
      </div>
    );
  }

  const chartData = buildCumulativeData(data, depositEurc);
  const totalYield = chartData.at(-1)?.yieldEurc ?? 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">Cumulative Yield</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Total EURC earned over the past 7 days
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-emerald-400 tabular-nums">
            +{totalYield.toFixed(2)} EURC
          </p>
          <p className="text-xs text-muted-foreground">7-day yield</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="yieldGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.06)"
            vertical={false}
          />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatDate}
            tick={{ fill: '#64748B', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={60}
          />
          <YAxis
            tickFormatter={(v: number) => `${v.toFixed(1)}`}
            tick={{ fill: '#64748B', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(value) => (
              <span style={{ color: '#94A3B8' }}>{value}</span>
            )}
          />
          <Area
            type="monotone"
            dataKey="yieldEurc"
            name="Blended Strategy"
            stroke="#10B981"
            strokeWidth={2}
            fill="url(#yieldGradient)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: '#10B981' }}
          />
          <Line
            type="monotone"
            dataKey="bestSingleYield"
            name="Best Single Protocol"
            stroke="#8B5CF6"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0, fill: '#8B5CF6' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
