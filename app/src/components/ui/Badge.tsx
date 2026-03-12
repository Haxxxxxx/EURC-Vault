import { cn } from '@/lib/utils';
import { HTMLAttributes, ReactNode } from 'react';

interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default';
}

export function Badge({ children, variant = 'default', className, ...props }: BadgeProps) {
  const variantClasses = {
    success: 'bg-success/10 text-success border-success/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
    error: 'bg-error/10 text-error border-error/20',
    info: 'bg-primary/10 text-primary border-primary/20',
    default: 'bg-glass text-foreground-secondary border-glass-border',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full',
        'text-xs font-medium border backdrop-blur-glass',
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
