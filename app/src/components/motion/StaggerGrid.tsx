'use client';

import { ReactNode, useMemo } from 'react';
import { motion, Variants } from 'framer-motion';

interface StaggerGridProps {
  children: ReactNode;
  stagger?: number;
  className?: string;
}

export function StaggerGrid({
  children,
  stagger = 0.1,
  className,
}: StaggerGridProps) {
  const containerVariants: Variants = useMemo(
    () => ({
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: { staggerChildren: stagger },
      },
    }),
    [stagger]
  );

  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      {children}
    </motion.div>
  );
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 350, damping: 30 },
  },
};

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}
