'use client';

import { useState, useMemo } from 'react';
import type { RangerMetrics } from '@/lib/types';
import { PROTOCOL_META } from '@/lib/constants';
import { ProtocolIcon } from '@/components/ui/ProtocolIcon';

interface EarningsCalculatorProps {
  metrics: RangerMetrics | null;
}

const PERIODS = [
  { label: '1 Week',  days: 7   },
  { label: '1 Month', days: 30  },
  { label: '3 Months',days: 90  },
  { label: '1 Year',  days: 365 },
] as const;

function formatEurc(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000)     return `${(amount / 1_000).toFixed(2)}K`;
  return amount.toFixed(2);
}

export function EarningsCalculator({ metrics }: EarningsCalculatorProps) {
  const [depositInput, setDepositInput] = useState('10000');
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState(1); // default: 1 month

  const deposit = useMemo(() => {
    const val = parseFloat(depositInput.replace(/,/g, ''));
    return isNaN(val) || val <= 0 ? 0 : val;
  }, [depositInput]);

  const apyPct = metrics?.currentApyPct ?? 0;
  const apyDecimal = apyPct / 100;
  const period = PERIODS[selectedPeriodIdx];

  // Compound interest: A = P(1 + r/n)^(nt) where n = 365 (daily compounding)
  const earned = useMemo(() => {
    if (deposit <= 0) return 0;
    const daily = apyDecimal / 365;
    return deposit * (Math.pow(1 + daily, period.days) - 1);
  }, [deposit, apyDecimal, period.days]);

  const finalBalance = deposit + earned;
  const effectiveApyPct = useMemo(() => {
    if (deposit <= 0) return apyPct;
    return ((Math.pow(1 + apyDecimal / 365, 365) - 1) * 100);
  }, [apyDecimal, apyPct, deposit]);

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-foreground">Earnings Calculator</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Project your EURC returns at current rates
        </p>
      </div>

      {/* Deposit input */}
      <div className="mb-4">
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          Deposit amount (EURC)
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
            €
          </span>
          <input
            type="text"
            value={depositInput}
            onChange={(e) => setDepositInput(e.target.value)}
            className="w-full rounded-xl border border-border bg-background-surface px-8 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 tabular-nums"
            placeholder="10,000"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            EURC
          </span>
        </div>
      </div>

      {/* Period selector */}
      <div className="mb-5">
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          Time period
        </label>
        <div className="grid grid-cols-4 gap-1.5">
          {PERIODS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => setSelectedPeriodIdx(i)}
              className={`rounded-lg py-1.5 text-xs font-medium transition-all ${
                selectedPeriodIdx === i
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/20 p-4 mb-4">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-xs text-muted-foreground">Projected yield</span>
          <span className="text-xs text-muted-foreground">{period.label}</span>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-2xl font-bold text-emerald-400 tabular-nums">
            +{formatEurc(earned)} EURC
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Final balance</span>
          <span className="text-foreground font-medium tabular-nums">
            {formatEurc(finalBalance)} EURC
          </span>
        </div>
      </div>

      {/* Rate breakdown */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Current blended APY</span>
          <span className="font-semibold text-foreground tabular-nums">
            {apyPct.toFixed(2)}%
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Effective APY (compounded daily)</span>
          <span className="font-semibold text-emerald-400 tabular-nums">
            {effectiveApyPct.toFixed(2)}%
          </span>
        </div>
        <div className="pt-2 border-t border-border">
          <p className="text-[11px] text-muted-foreground mb-1.5">Rate breakdown</p>
          <div className="space-y-1">
            {(
              [
                ['drift',  metrics?.driftApyPct  ?? 0,  '50%'],
                ['kamino', metrics?.kaminoApyPct ?? 0,  '30%'],
                ['save',   metrics?.saveApyPct   ?? 0,  '15%'],
              ] as [keyof typeof PROTOCOL_META, number, string][]
            ).map(([proto, apy, alloc]) => (
              <div key={proto} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <ProtocolIcon protocol={proto} size={10} />
                  <span className="text-muted-foreground">
                    {PROTOCOL_META[proto].label} ({alloc})
                  </span>
                </div>
                <span className="tabular-nums" style={{ color: PROTOCOL_META[proto].color }}>
                  {apy.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground mt-4 leading-relaxed">
        Projections based on current rates. Actual returns vary with market conditions and rebalancing outcomes. Past performance does not guarantee future results.
      </p>
    </div>
  );
}
