'use client';

import { useApyHistory, type ApyDataPoint } from '@/hooks/useChartData';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTheme } from 'next-themes';

interface ApyHistoryChartProps {
  epochs?: number;
  baseApy?: number;
  data?: ApyDataPoint[];
}

function ApyTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-glass border border-glass-border backdrop-blur-glass px-3 py-2 shadow-glass">
      <p className="text-xs font-light text-foreground-secondary">
        Epoch #{payload[0].payload.epoch}
      </p>
      <p className="text-sm font-medium text-success">
        {payload[0].value.toFixed(2)}% APY
      </p>
    </div>
  );
}

export function ApyHistoryChart({ epochs = 12, baseApy = 4.5, data: externalData }: ApyHistoryChartProps) {
  const hookData = useApyHistory(epochs, baseApy);
  const data = externalData ?? hookData;
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#8A8F9E' : '#6B7080';

  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="apyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isDark ? 'rgba(16,185,129,0.3)' : 'rgba(5,150,105,0.2)'} />
              <stop offset="100%" stopColor="rgba(16,185,129,0)" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis
            dataKey="epoch"
            tickFormatter={(v) => `#${v}`}
            stroke={textColor}
            fontSize={11}
            fontWeight={300}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={(v) => `${v}%`}
            stroke={textColor}
            fontSize={11}
            fontWeight={300}
            tickLine={false}
            axisLine={false}
            domain={['auto', 'auto']}
          />
          <Tooltip content={<ApyTooltip />} />
          <Area
            type="monotone"
            dataKey="apy"
            stroke={isDark ? '#10B981' : '#059669'}
            strokeWidth={2}
            fill="url(#apyGradient)"
            animationDuration={1000}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
