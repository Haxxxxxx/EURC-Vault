import { cn } from '@/lib/utils';
import { HTMLAttributes } from 'react';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: string;
  height?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

export function Skeleton({ width, height, rounded = 'md', className, ...props }: SkeletonProps) {
  const roundedClasses = {
    sm: 'rounded',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    full: 'rounded-full',
  };

  return (
    <div
      className={cn(
        'animate-pulse bg-glass border border-glass-border',
        roundedClasses[rounded],
        className
      )}
      style={{ width, height }}
      {...props}
    />
  );
}
