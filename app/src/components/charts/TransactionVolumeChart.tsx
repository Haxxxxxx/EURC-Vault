'use client';

import { useTransactionVolume } from '@/hooks/useChartData';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useTheme } from 'next-themes';

interface TransactionVolumeChartProps {
  weeks?: number;
}

function VolumeTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-glass border border-glass-border backdrop-blur-glass px-3 py-2 shadow-glass">
      <p className="text-xs font-light text-foreground-secondary mb-1">Week of {label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-xs font-medium" style={{ color: p.color }}>
          {p.name}: €{p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

function VolumeLegend({ payload }: any) {
  if (!payload) return null;
  return (
    <div className="flex justify-center gap-6 mt-2">
      {payload.map((entry: any) => (
        <div key={entry.value} className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: entry.color }} />
          <span className="text-xs font-light text-foreground-secondary">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export function TransactionVolumeChart({ weeks = 12 }: TransactionVolumeChartProps) {
  const data = useTransactionVolume(weeks);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#8A8F9E' : '#6B7080';
  const depositColor = isDark ? '#10B981' : '#059669';
  const withdrawColor = isDark ? '#EF4444' : '#DC2626';
  const rewardColor = '#003399';

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis
            dataKey="week"
            stroke={textColor}
            fontSize={11}
            fontWeight={300}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`}
            stroke={textColor}
            fontSize={11}
            fontWeight={300}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<VolumeTooltip />} />
          <Legend content={<VolumeLegend />} />
          <Bar
            dataKey="deposits"
            name="Deposits"
            fill={depositColor}
            radius={[3, 3, 0, 0]}
            stackId="stack"
            animationDuration={800}
          />
          <Bar
            dataKey="withdrawals"
            name="Withdrawals"
            fill={withdrawColor}
            radius={[0, 0, 0, 0]}
            stackId="stack"
            animationDuration={800}
          />
          <Bar
            dataKey="rewards"
            name="Rewards"
            fill={rewardColor}
            radius={[0, 0, 0, 0]}
            stackId="stack"
            animationDuration={800}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
