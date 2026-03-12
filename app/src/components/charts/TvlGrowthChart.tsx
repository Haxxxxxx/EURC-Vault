'use client';

import { useTvlHistory, type TvlDataPoint } from '@/hooks/useChartData';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTheme } from 'next-themes';

interface TvlGrowthChartProps {
  days?: number;
  baseTvl?: number;
  data?: TvlDataPoint[];
}

function TvlTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg bg-glass border border-glass-border backdrop-blur-glass px-3 py-2 shadow-glass">
      <p className="text-xs font-light text-foreground-secondary mb-1">{point.date}</p>
      <p className="text-sm font-medium text-foreground">
        TVL: €{(point.tvl / 1_000_000).toFixed(2)}M
      </p>
      <p className="text-xs font-light text-foreground-secondary">
        Stakers: {point.stakers}
      </p>
    </div>
  );
}

export function TvlGrowthChart({ days = 90, baseTvl = 4_000_000, data: externalData }: TvlGrowthChartProps) {
  const hookData = useTvlHistory(days, baseTvl);
  const data = externalData ?? hookData;
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#8A8F9E' : '#6B7080';

  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="tvlGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isDark ? 'rgba(0,51,153,0.35)' : 'rgba(0,51,153,0.15)'} />
              <stop offset="100%" stopColor="rgba(0,51,153,0)" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis
            dataKey="date"
            stroke={textColor}
            fontSize={11}
            fontWeight={300}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="tvl"
            tickFormatter={(v) => `€${(v / 1_000_000).toFixed(1)}M`}
            stroke={textColor}
            fontSize={11}
            fontWeight={300}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="stakers"
            orientation="right"
            stroke={textColor}
            fontSize={11}
            fontWeight={300}
            tickLine={false}
            axisLine={false}
            hide
          />
          <Tooltip content={<TvlTooltip />} />
          <Area
            yAxisId="tvl"
            type="monotone"
            dataKey="tvl"
            stroke="#003399"
            strokeWidth={2}
            fill="url(#tvlGradient)"
            animationDuration={1000}
            animationEasing="ease-out"
          />
          <Line
            yAxisId="stakers"
            type="monotone"
            dataKey="stakers"
            stroke={isDark ? '#F59E0B' : '#D97706'}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            animationDuration={1200}
            animationEasing="ease-out"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
