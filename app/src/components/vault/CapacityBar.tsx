'use client';

import { formatEurcDisplay, formatPercentage } from '@/lib/utils';
import { EURC_DECIMALS } from '@/lib/constants';
import { motion } from 'framer-motion';

interface CapacityBarProps {
  tvl: number;
  capacity: number;
  className?: string;
}

export function CapacityBar({ tvl, capacity, className }: CapacityBarProps) {
  const percentage = (tvl / capacity) * 100;
  const remaining = capacity - tvl;
  const isNearFull = percentage >= 80;
  const isFull = percentage >= 100;

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">
          Vault Capacity
        </span>
        <span className="text-sm font-medium text-foreground">
          {formatEurcDisplay(tvl, EURC_DECIMALS)} / {formatEurcDisplay(capacity, EURC_DECIMALS)} EURC
        </span>
      </div>
      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full ${
            isFull
              ? 'bg-gradient-to-r from-error to-error/80'
              : isNearFull
                ? 'bg-gradient-to-r from-warning to-error/70'
                : 'bg-gradient-to-r from-primary to-accent'
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(percentage, 100)}%` }}
          transition={{ type: 'spring', stiffness: 60, damping: 20, duration: 0.8 }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20" />
        </motion.div>
        {/* Glow pulse when near full */}
        {isNearFull && (
          <motion.div
            className={`absolute inset-y-0 left-0 rounded-full ${isFull ? 'bg-error/30' : 'bg-warning/30'}`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(percentage, 100)}%` }}
            transition={{ type: 'spring', stiffness: 60, damping: 20, duration: 0.8 }}
            style={{ filter: 'blur(4px)' }}
          />
        )}
      </div>
      <div className="flex items-center justify-between mt-2 text-sm">
        <span className={`font-medium ${isFull ? 'text-error' : isNearFull ? 'text-warning' : 'text-accent'}`}>
          {formatPercentage(percentage)} Filled
        </span>
        <span className="text-muted-foreground">
          {isFull
            ? 'Deposits blocked'
            : `${formatEurcDisplay(remaining, EURC_DECIMALS)} EURC Available`}
        </span>
      </div>
    </div>
  );
}
