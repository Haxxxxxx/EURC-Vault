'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
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
  tvlEurc: number;
}

/**
 * Derive cumulative yield from TVL history.
 * Yield = TVL(t) - TVL(0)  (simplified — ignores net inflows)
 */
function buildCumulativeData(points: MetricsPoint[], depositEurc: number): CumulativePoint[] {
  if (points.length === 0) return [];

  // Use the first point's TVL as the baseline, scaled to the user's deposit
  const baseTvl = points[0].tvlEurc;
  const scale = depositEurc / baseTvl;

  // Down-sample to max 100 points for performance
  const step = Math.max(1, Math.floor(points.length / 100));
  return points
    .filter((_, i) => i % step === 0)
    .map((p) => ({
      timestamp: p.timestamp,
      tvlEurc: parseFloat((p.tvlEurc * scale).toFixed(2)),
      yieldEurc: parseFloat(Math.max(0, (p.tvlEurc - baseTvl) * scale).toFixed(2)),
    }));
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const yieldVal = (payload as Array<{ value: number }>)[0]?.value ?? 0;

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-lg text-xs">
      <p className="text-muted-foreground mb-1">
        {new Date(label as number).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        <span className="text-muted-foreground">Yield earned</span>
        <span className="font-semibold text-emerald-400 tabular-nums">
          {yieldVal.toFixed(4)} EURC
        </span>
      </div>
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
          <Area
            type="monotone"
            dataKey="yieldEurc"
            stroke="#10B981"
            strokeWidth={2}
            fill="url(#yieldGradient)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: '#10B981' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
