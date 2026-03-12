'use client';

import { ReactNode, useMemo } from 'react';
import { motion } from 'framer-motion';

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  className?: string;
  viewTrigger?: boolean;
}

const directionOffset: Record<string, { x?: number; y?: number }> = {
  up: { y: 20 },
  down: { y: -20 },
  left: { x: 20 },
  right: { x: -20 },
};

export function FadeIn({
  children,
  delay = 0,
  duration = 0.5,
  direction = 'up',
  className,
  viewTrigger = true,
}: FadeInProps) {
  const offset = directionOffset[direction] ?? { y: 20 };

  const initial = useMemo(
    () => ({ opacity: 0, ...offset }),
    [offset]
  );

  const animate = useMemo(
    () => ({ opacity: 1, x: 0, y: 0 }),
    []
  );

  const transition = useMemo(
    () => ({ duration, delay, ease: 'easeOut' as const }),
    [duration, delay]
  );

  if (viewTrigger) {
    return (
      <motion.div
        className={className}
        initial={initial}
        whileInView={animate}
        viewport={{ once: true }}
        transition={transition}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={className}
      initial={initial}
      animate={animate}
      transition={transition}
    >
      {children}
    </motion.div>
  );
}
