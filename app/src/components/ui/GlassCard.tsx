'use client';

import { cn } from '@/lib/utils';
import { HTMLAttributes, ReactNode } from 'react';
import { motion } from 'framer-motion';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

const glassStyle = {
  background: 'var(--glass-bg)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
} as const;

export function GlassCard({
  children,
  hover = false,
  padding = 'none',
  loading = false,
  className,
  ...props
}: GlassCardProps) {
  const classes = cn(
    'rounded-2xl backdrop-blur-glass border border-border shadow-xl',
    paddingClasses[padding],
    loading && 'overflow-hidden',
    className
  );

  const content = (
    <>
      <div className={cn(loading && 'opacity-50 transition-opacity duration-300')}>
        {children}
      </div>
      {loading && (
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/10 to-transparent skeleton-shimmer pointer-events-none" />
      )}
    </>
  );

  if (hover) {
    return (
      <motion.div
        className={cn(classes, 'cursor-pointer relative')}
        style={glassStyle}
        whileHover={{ y: -2, scale: 1.005 }}
        whileTap={{ scale: 0.995 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        {...(props as any)}
      >
        {content}
      </motion.div>
    );
  }

  return (
    <div className={cn(classes, 'relative')} style={glassStyle} {...props}>
      {content}
    </div>
  );
}
