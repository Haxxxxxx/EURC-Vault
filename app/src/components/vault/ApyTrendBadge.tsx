'use client';

import { TrendUp, TrendDown, Minus } from '@phosphor-icons/react';

interface ApyTrendBadgeProps {
  currentApy: number;
  previousApy: number;
}

export function ApyTrendBadge({ currentApy, previousApy }: ApyTrendBadgeProps) {
  const diff = currentApy - previousApy;
  const absDiff = Math.abs(diff);

  if (absDiff < 0.01) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-foreground-secondary">
        <Minus className="w-3 h-3" weight="bold" />
        Stable
      </span>
    );
  }

  if (diff > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-500 font-medium">
        <TrendUp className="w-3 h-3" weight="bold" />
        +{absDiff.toFixed(2)}%
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] text-red-500 font-medium">
      <TrendDown className="w-3 h-3" weight="bold" />
      -{absDiff.toFixed(2)}%
    </span>
  );
}
