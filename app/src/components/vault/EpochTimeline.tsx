import { useEpochCountdown } from '@/hooks/useEpochCountdown';
import { cn } from '@/lib/utils';
import { EPOCH_DURATION } from '@/lib/constants';

const STAGES = [
  { label: 'Deposit', percent: 25 },
  { label: 'Earning', percent: 50 },
  { label: 'Rewards', percent: 75 },
  { label: 'Distribution', percent: 100 },
];

export function EpochTimeline() {
  const { secondsRemaining, epochNumber } = useEpochCountdown();
  const currentPercent = ((EPOCH_DURATION - secondsRemaining) / EPOCH_DURATION) * 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">Epoch #{epochNumber}</h4>
        <span className="text-sm font-light text-foreground-secondary">
          {Math.round(currentPercent)}% Complete
        </span>
      </div>

      <div className="relative">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-glass" />
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-primary transition-all duration-1000"
          style={{ width: `${currentPercent}%` }}
        />

        <div className="relative flex items-center justify-between">
          {STAGES.map((stage, index) => {
            const isActive = currentPercent >= stage.percent;
            const isCurrent = currentPercent < stage.percent && (index === 0 || currentPercent >= STAGES[index - 1].percent);

            return (
              <div key={stage.label} className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-3 h-3 rounded-full border-2 transition-all duration-300',
                    isActive
                      ? 'bg-primary border-primary'
                      : isCurrent
                      ? 'bg-primary/50 border-primary animate-pulse'
                      : 'bg-background border-glass-border'
                  )}
                />
                <span
                  className={cn(
                    'mt-2 text-xs font-light transition-colors',
                    isActive || isCurrent
                      ? 'text-foreground'
                      : 'text-foreground-secondary'
                  )}
                >
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
