'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import type { MetricsPoint } from '@/hooks/useMetricsHistory';
import { PROTOCOL_META } from '@/lib/constants';

interface ApyTrendChartProps {
  data: MetricsPoint[];
  loading: boolean;
}

// Down-sample data for chart performance (max 200 points)
function downsample(points: MetricsPoint[], maxPoints: number): MetricsPoint[] {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  return points.filter((_, i) => i % step === 0);
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTooltipLabel(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-lg text-xs space-y-1.5">
      <p className="text-muted-foreground mb-1">{formatTooltipLabel(label as number)}</p>
      {(payload as Array<{ name: string; value: number; color: string }>).map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}</span>
          </div>
          <span className="font-semibold tabular-nums" style={{ color: entry.color }}>
            {entry.value.toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  );
}

export function ApyTrendChart({ data, loading }: ApyTrendChartProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="h-5 w-40 rounded bg-secondary animate-pulse mb-4" />
        <div className="h-64 w-full rounded-xl bg-secondary/30 animate-pulse" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground mb-2">7-Day APY Trend</h2>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">No historical data available yet</p>
          <p className="text-xs text-muted-foreground mt-1">Data will appear once the bot starts logging metrics</p>
        </div>
      </div>
    );
  }

  const chartData = downsample(data, 200);

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-foreground">7-Day APY Trend</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Live protocol rates and blended portfolio APY over time
        </p>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="blendedApyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F1F5F9" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#F1F5F9" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.06)"
            vertical={false}
          />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTime}
            tick={{ fill: '#64748B', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={80}
          />
          <YAxis
            tickFormatter={(v: number) => `${v.toFixed(1)}%`}
            tick={{ fill: '#64748B', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            domain={['auto', 'auto']}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            formatter={(value) => (
              <span style={{ color: '#94A3B8' }}>{value}</span>
            )}
          />

          {/* Holding EURC baseline (0% yield) */}
          <ReferenceLine
            y={0}
            stroke="#475569"
            strokeDasharray="6 4"
            strokeWidth={1}
            label={{
              value: 'Holding EURC (0%)',
              position: 'insideBottomRight',
              fill: '#475569',
              fontSize: 10,
            }}
          />

          {/* Protocol lines */}
          <Line
            type="monotone"
            dataKey="driftApyPct"
            name="Drift"
            stroke={PROTOCOL_META.drift.color}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey="kaminoApyPct"
            name="Kamino"
            stroke={PROTOCOL_META.kamino.color}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey="saveApyPct"
            name="Save"
            stroke={PROTOCOL_META.save.color}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />

          {/* Blended APY — thicker, white, prominent with glow */}
          <Line
            type="monotone"
            dataKey="currentApyPct"
            name="Blended APY"
            stroke="#F1F5F9"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 6, strokeWidth: 2, stroke: '#F1F5F9', fill: 'var(--card)' }}
            strokeDasharray="0"
            filter="drop-shadow(0 0 4px rgba(241,245,249,0.3))"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
