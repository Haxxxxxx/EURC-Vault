'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useRouteProgress } from '@/providers/RouteProgressProvider';

export function RouteProgressBar() {
  const { isNavigating } = useRouteProgress();

  return (
    <AnimatePresence>
      {isNavigating && (
        <motion.div
          className="fixed top-0 left-0 right-0 z-[9999] h-[2px]"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="h-full bg-gradient-to-r from-primary via-accent to-primary"
            initial={{ width: '0%' }}
            animate={{ width: '90%' }}
            transition={{ duration: 2, ease: 'easeOut' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
