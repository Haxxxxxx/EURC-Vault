'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useToast, type ToastVariant } from '@/providers/ToastProvider';
import { CheckCircle, XCircle, SpinnerGap, Info, ArrowSquareOut, X } from '@phosphor-icons/react';
import { NETWORK } from '@/lib/constants';

const VARIANT_STYLES: Record<ToastVariant, { icon: typeof CheckCircle; iconClass: string; borderClass: string }> = {
  success: { icon: CheckCircle, iconClass: 'text-success', borderClass: 'border-success/30' },
  error: { icon: XCircle, iconClass: 'text-red-400', borderClass: 'border-red-400/30' },
  pending: { icon: SpinnerGap, iconClass: 'text-primary animate-spin', borderClass: 'border-primary/30' },
  info: { icon: Info, iconClass: 'text-blue-400', borderClass: 'border-blue-400/30' },
};

function getSolscanUrl(sig: string): string {
  const cluster = NETWORK === 'devnet' ? '?cluster=devnet' : '';
  return `https://solscan.io/tx/${sig}${cluster}`;
}

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const style = VARIANT_STYLES[toast.variant];
          const Icon = style.icon;

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto rounded-xl bg-glass border ${style.borderClass} backdrop-blur-glass shadow-glass p-4`}
            >
              <div className="flex items-start gap-3">
                <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${style.iconClass}`} weight="bold" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{toast.title}</p>
                  {toast.description && (
                    <p className="text-xs font-light text-foreground-secondary mt-0.5">
                      {toast.description}
                    </p>
                  )}
                  {toast.txSignature && (
                    <a
                      href={getSolscanUrl(toast.txSignature)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-hover mt-1.5 transition-colors"
                    >
                      View on Solscan
                      <ArrowSquareOut className="w-3 h-3" weight="bold" />
                    </a>
                  )}
                </div>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="flex-shrink-0 text-foreground-secondary hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" weight="bold" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
