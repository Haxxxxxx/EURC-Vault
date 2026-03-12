'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  className,
}: EmptyStateProps) {
  return (
    <GlassCard padding="lg" className={cn('text-center', className)}>
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        {icon}
      </div>
      <h3 className="text-xl font-medium text-foreground mb-2">{title}</h3>
      <p className="text-sm font-light text-foreground-secondary max-w-sm mx-auto mb-6">
        {description}
      </p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-primary to-accent shadow-md hover:shadow-lg transition-all duration-200"
        >
          {actionLabel}
        </Link>
      )}
    </GlassCard>
  );
}
