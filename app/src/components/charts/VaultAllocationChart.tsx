'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { AllocationDataPoint } from '@/hooks/useChartData';

interface VaultAllocationChartProps {
  data: AllocationDataPoint[];
}

function AllocationTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0].payload;
  return (
    <div className="rounded-lg bg-glass border border-glass-border backdrop-blur-glass px-3 py-2 shadow-glass">
      <p className="text-xs font-light text-foreground-secondary">{name}</p>
      <p className="text-sm font-medium text-foreground">
        €{value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}

export function VaultAllocationChart({ data }: VaultAllocationChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (data.length === 0) return null;

  return (
    <div>
      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer>
          <PieChart>
            <Tooltip content={<AllocationTooltip />} />
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={3}
              dataKey="value"
              animationDuration={800}
              animationEasing="ease-out"
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} stroke="none" />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {data.map((entry) => {
          const pct = ((entry.value / total) * 100).toFixed(1);
          return (
            <div key={entry.name} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs font-light text-foreground-secondary">
                {entry.name} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
