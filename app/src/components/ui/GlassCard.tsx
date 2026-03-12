import { cn } from '@/lib/utils';
import { HTMLAttributes, ReactNode } from 'react';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function GlassCard({
  children,
  hover = false,
  padding = 'lg',
  className,
  ...props
}: GlassCardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={cn(
        'rounded-2xl backdrop-blur-glass',
        'bg-glass border border-glass-border',
        'shadow-glass transition-all duration-300',
        hover && 'hover:-translate-y-0.5 hover:shadow-glass-hover cursor-pointer',
        paddingClasses[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
