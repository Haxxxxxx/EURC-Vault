'use client';

import { useEpochCountdown } from '@/hooks/useEpochCountdown';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

interface EpochCountdownProps {
  className?: string;
}

function DigitBox({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative overflow-hidden w-9 h-8 rounded-lg bg-glass border border-glass-border flex items-center justify-center">
        <AnimatePresence mode="popLayout">
          <motion.span
            key={value}
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="text-sm font-mono font-semibold tabular-nums text-foreground"
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </div>
      <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  );
}

export function EpochCountdown({ className }: EpochCountdownProps) {
  const { formatted, epochNumber } = useEpochCountdown();

  return (
    <div className={cn('flex items-center gap-3 px-4 h-12 rounded-xl bg-muted/50 border border-border', className)}>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        <span className="text-sm text-muted-foreground">Epoch {epochNumber}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <DigitBox value={String(formatted.days)} label="d" />
        <span className="text-foreground-secondary font-light text-xs mt-[-10px]">:</span>
        <DigitBox value={String(formatted.hours).padStart(2, '0')} label="h" />
        <span className="text-foreground-secondary font-light text-xs mt-[-10px]">:</span>
        <DigitBox value={String(formatted.minutes).padStart(2, '0')} label="m" />
      </div>
    </div>
  );
}
