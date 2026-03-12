'use client';

import { useEpochCountdown } from '@/hooks/useEpochCountdown';
import { cn } from '@/lib/utils';

interface EpochCountdownProps {
  className?: string;
  showLabel?: boolean;
}

export function EpochCountdown({ className, showLabel = true }: EpochCountdownProps) {
  const { formatted } = useEpochCountdown();

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showLabel && (
        <span className="text-sm font-light text-foreground-secondary">
          Epoch ends in:
        </span>
      )}
      <div className="flex items-center gap-1 font-medium text-foreground">
        <span className="tabular-nums">{formatted.days}d</span>
        <span className="text-foreground-secondary">:</span>
        <span className="tabular-nums">{String(formatted.hours).padStart(2, '0')}h</span>
        <span className="text-foreground-secondary">:</span>
        <span className="tabular-nums">{String(formatted.minutes).padStart(2, '0')}m</span>
        <span className="text-foreground-secondary">:</span>
        <span className="tabular-nums animate-pulse-slow">
          {String(formatted.seconds).padStart(2, '0')}s
        </span>
      </div>
    </div>
  );
}
