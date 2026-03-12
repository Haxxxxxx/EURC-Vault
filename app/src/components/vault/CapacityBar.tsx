import { formatEurcDisplay, formatPercentage } from '@/lib/utils';
import { EURC_DECIMALS } from '@/lib/constants';

interface CapacityBarProps {
  tvl: number;
  capacity: number;
  className?: string;
}

export function CapacityBar({ tvl, capacity, className }: CapacityBarProps) {
  const percentage = (tvl / capacity) * 100;
  const remaining = capacity - tvl;

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-light text-foreground-secondary">
          Capacity: {formatPercentage(percentage)} filled
        </span>
        <span className="text-sm font-medium text-foreground">
          {formatEurcDisplay(remaining, EURC_DECIMALS)} EURC remaining
        </span>
      </div>
      <div className="relative h-1 bg-glass rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary-hover rounded-full transition-all duration-700 shadow-glow"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}
