'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PROTOCOL_META } from '@/lib/constants';
import { useRangerMetrics } from '@/hooks/useRangerMetrics';

const MOCK_ALLOCATION = [
  { id: 'drift',  name: 'Drift',  value: 50, color: PROTOCOL_META.drift.color  },
  { id: 'kamino', name: 'Kamino', value: 30, color: PROTOCOL_META.kamino.color },
  { id: 'save',   name: 'Save',   value: 15, color: PROTOCOL_META.save.color   },
  { id: 'idle',   name: 'Idle',   value: 5,  color: PROTOCOL_META.idle.color   },
];

function formatTvl(tvl: number): string {
  if (tvl >= 1_000_000) return `€${(tvl / 1_000_000).toFixed(2)}M`;
  if (tvl >= 1_000) return `€${(tvl / 1_000).toFixed(1)}K`;
  return `€${tvl.toFixed(0)}`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { color: string } }>;
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
    </div>
  );
}

export function AllocationChart() {
  const { metrics } = useRangerMetrics();
  const tvl = metrics?.tvlEurc;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">Capital Allocation</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Current deployment across protocols</p>
      </div>

      {/* Donut Chart */}
      <div className="relative">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={MOCK_ALLOCATION}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {MOCK_ALLOCATION.map((entry) => (
                <Cell key={entry.id} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-lg font-bold text-foreground">
            {tvl ? formatTvl(tvl) : '—'}
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">TVL</span>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
        {MOCK_ALLOCATION.map((entry) => (
          <div key={entry.id} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs text-muted-foreground">{entry.name}</span>
            <span className="ml-auto text-xs font-medium text-foreground tabular-nums">{entry.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
