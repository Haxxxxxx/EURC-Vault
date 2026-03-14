'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { computeAllocation } from '@/lib/allocation';
import { useRangerMetrics } from '@/hooks/useRangerMetrics';
import { ProtocolIcon } from '@/components/ui/ProtocolIcon';
import type { ProtocolId, RangerRatesDoc } from '@/lib/types';

function formatTvl(tvl: number): string {
  if (tvl >= 1_000_000) return `€${(tvl / 1_000_000).toFixed(2)}M`;
  if (tvl >= 1_000) return `€${(tvl / 1_000).toFixed(1)}K`;
  return `€${tvl.toFixed(0)}`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { color: string; eurcValue?: string } }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-foreground">
        <span style={{ color: item.payload.color }}>{item.name}</span>
        {' — '}{item.value}%
      </p>
      {item.payload.eurcValue && (
        <p className="text-[11px] text-muted-foreground mt-0.5">
          ≈ {item.payload.eurcValue} EURC
        </p>
      )}
    </div>
  );
}

interface AllocationChartProps {
  rates: RangerRatesDoc | null;
}

export function AllocationChart({ rates }: AllocationChartProps) {
  const { metrics } = useRangerMetrics();
  const tvl = metrics?.tvlEurc ?? 100_000;

  const allocation = useMemo(() => computeAllocation(rates), [rates]);

  const chartData = useMemo(
    () =>
      allocation.map((entry) => ({
        id: entry.id,
        name: entry.label,
        value: entry.pct,
        color: entry.color,
        eurcValue: formatTvl((tvl * entry.pct) / 100),
      })),
    [allocation, tvl],
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">Capital Allocation</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Rate-weighted deployment across protocols</p>
      </div>

      {/* Donut Chart */}
      <div className="relative">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
              animationDuration={800}
            >
              {chartData.map((entry) => (
                <Cell key={entry.id} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-lg font-bold text-foreground">
            {formatTvl(tvl)}
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">TVL</span>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
        {chartData.map((entry) => (
          <div key={entry.id} className="flex items-center gap-2">
            {entry.id === 'idle' ? (
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
            ) : (
              <ProtocolIcon protocol={entry.id as ProtocolId} size={14} />
            )}
            <span className="text-xs text-muted-foreground">{entry.name}</span>
            <span className="ml-auto text-xs font-medium text-foreground tabular-nums">{entry.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
