'use client';

import { usePortfolioHistory } from '@/hooks/useChartData';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { useTheme } from 'next-themes';

interface PortfolioSparklineProps {
  days?: number;
  baseValue?: number;
  height?: number;
}

function SparklineTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-glass border border-glass-border backdrop-blur-glass px-3 py-2 shadow-glass">
      <p className="text-xs font-light text-foreground-secondary">{payload[0].payload.date}</p>
      <p className="text-sm font-medium text-foreground">
        €{payload[0].value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}

export function PortfolioSparkline({ days = 30, baseValue = 60000, height = 80 }: PortfolioSparklineProps) {
  const data = usePortfolioHistory(days, baseValue);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const strokeColor = '#003399';
  const gradientStart = isDark ? 'rgba(0,51,153,0.4)' : 'rgba(0,51,153,0.2)';
  const gradientEnd = isDark ? 'rgba(0,51,153,0.0)' : 'rgba(0,51,153,0.0)';

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={gradientStart} />
              <stop offset="100%" stopColor={gradientEnd} />
            </linearGradient>
          </defs>
          <Tooltip content={<SparklineTooltip />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={strokeColor}
            strokeWidth={2}
            fill="url(#sparklineGradient)"
            animationDuration={1200}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
