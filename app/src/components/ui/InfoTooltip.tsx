'use client';

import { Info } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface InfoTooltipProps {
  text: string;
  className?: string;
}

export function InfoTooltip({ text, className }: InfoTooltipProps) {
  return (
    <span
      className={cn('relative inline-flex items-center group', className)}
      tabIndex={0}
      role="note"
      aria-label={text}
    >
      <Info
        className="w-3.5 h-3.5 text-foreground-secondary cursor-help"
        weight="bold"
        aria-hidden
      />
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-xl bg-glass border border-glass-border backdrop-blur-glass p-3 text-xs font-light text-foreground-secondary opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 shadow-lg z-50"
      >
        {text}
      </span>
    </span>
  );
}
