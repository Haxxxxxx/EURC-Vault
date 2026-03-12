'use client';

import { useState, useEffect } from 'react';
import { formatCountdown } from '@/lib/utils';

interface AdminEpochProgressBarProps {
  epochStartTime: number;
  epochDuration: number;
  currentEpoch: number;
}

export function AdminEpochProgressBar({
  epochStartTime,
  epochDuration,
  currentEpoch,
}: AdminEpochProgressBarProps) {
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

  const epochEnd = epochStartTime + epochDuration;
  const remaining = Math.max(epochEnd - now, 0);
  const elapsed = epochDuration - remaining;
  const progress = epochDuration > 0 ? Math.min((elapsed / epochDuration) * 100, 100) : 0;
  const cd = formatCountdown(remaining);
  const isExpired = remaining <= 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-foreground-secondary">
          Epoch {currentEpoch}
        </span>
        <span className={isExpired ? 'text-amber-500 font-medium' : 'text-foreground-secondary'}>
          {isExpired
            ? 'Ready to advance'
            : `${cd.days}d ${cd.hours}h ${cd.minutes}m remaining`}
        </span>
      </div>
      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ${
            isExpired ? 'bg-amber-500' : 'bg-primary'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
