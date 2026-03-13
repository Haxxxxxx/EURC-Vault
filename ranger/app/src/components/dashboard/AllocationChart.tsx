'use client';

import { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PROTOCOL_META } from '@/lib/constants';
import { useRangerMetrics } from '@/hooks/useRangerMetrics';
import { useRangerRates } from '@/hooks/useRangerRates';

/** Derive allocation from live rates — highest rate gets 60-65%, others proportional, 5% idle */
function deriveAllocation(rates: { drift: number; kamino: number; save: number }) {
  const total = rates.drift + rates.kamino + rates.save;
  if (total === 0) return [50, 30, 15, 5];

  // Rate-weighted allocation with caps
  const raw = {
    drift:  (rates.drift / total) * 95,
    kamino: (rates.kamino / total) * 95,
    save:   (rates.save / total) * 95,
  };

  // Clamp to [10, 70] range
  const clamped = {
    drift:  Math.max(10, Math.min(70, raw.drift)),
    kamino: Math.max(10, Math.min(70, raw.kamino)),
    save:   Math.max(10, Math.min(70, raw.save)),
  };

  // Normalize so clamped + idle = 100
  const sum = clamped.drift + clamped.kamino + clamped.save;
  const scale = 95 / sum;

  return [
    Math.round(clamped.drift * scale),
    Math.round(clamped.kamino * scale),
    Math.round(clamped.save * scale),
    5, // idle reserve
  ];
}

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

export function AllocationChart() {
  const { metrics } = useRangerMetrics();
  const { rates } = useRangerRates();
  const tvl = metrics?.tvlEurc ?? 100_000;

  // Derive allocation from current rates (updates when rates jitter)
  const allocation = useMemo(() => {
    if (!rates) return [50, 30, 15, 5];
    return deriveAllocation({
      drift: rates.drift.apy,
      kamino: rates.kamino.apy,
      save: rates.save.apy,
    });
  }, [rates]);

  const chartData = useMemo(() => [
    { id: 'drift',  name: 'Drift',  value: allocation[0], color: PROTOCOL_META.drift.color,  eurcValue: formatTvl(tvl * allocation[0] / 100) },
    { id: 'kamino', name: 'Kamino', value: allocation[1], color: PROTOCOL_META.kamino.color, eurcValue: formatTvl(tvl * allocation[1] / 100) },
    { id: 'save',   name: 'Save',   value: allocation[2], color: PROTOCOL_META.save.color,   eurcValue: formatTvl(tvl * allocation[2] / 100) },
    { id: 'idle',   name: 'Idle',   value: allocation[3], color: PROTOCOL_META.idle.color,   eurcValue: formatTvl(tvl * allocation[3] / 100) },
  ], [allocation, tvl]);

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
