'use client';

import { createContext, useContext, useCallback, useState, ReactNode } from 'react';

export type ToastVariant = 'success' | 'error' | 'pending' | 'info';

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  txSignature?: string;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  updateToast: (id: string, updates: Partial<Omit<Toast, 'id'>>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  addToast: () => '',
  updateToast: () => {},
  removeToast: () => {},
});

let toastCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${++toastCounter}`;
    setToasts((prev) => [...prev, { ...toast, id }]);

    // Auto-dismiss non-pending toasts after 6s
    if (toast.variant !== 'pending') {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 6000);
    }

    return id;
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<Omit<Toast, 'id'>>) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    );

    // Auto-dismiss after update if no longer pending
    if (updates.variant && updates.variant !== 'pending') {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 6000);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, updateToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
