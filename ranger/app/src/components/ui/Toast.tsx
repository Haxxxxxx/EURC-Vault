'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration: number;
  /** Set to true when the toast is in its exit animation. */
  exiting?: boolean;
}

type ToastAction =
  | { kind: 'ADD'; toast: ToastItem }
  | { kind: 'DISMISS'; id: string }
  | { kind: 'REMOVE'; id: string };

interface ToastOptions {
  type?: ToastType;
  title?: string;
  /** Auto-dismiss duration in ms. Default: 5000. Pass 0 to disable. */
  duration?: number;
}

interface ToastContextValue {
  toast: (message: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const MAX_VISIBLE = 3;
const EXIT_ANIMATION_MS = 300;

let toastCounter = 0;
function nextId(): string {
  toastCounter += 1;
  return `toast-${toastCounter}-${Date.now()}`;
}

const ICON_MAP: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const COLOR_MAP: Record<ToastType, { bg: string; icon: string; border: string }> = {
  success: {
    bg: 'bg-success/10',
    icon: 'text-success',
    border: 'border-success/30',
  },
  error: {
    bg: 'bg-error/10',
    icon: 'text-error',
    border: 'border-error/30',
  },
  info: {
    bg: 'bg-primary/10',
    icon: 'text-primary',
    border: 'border-primary/30',
  },
  warning: {
    bg: 'bg-warning/10',
    icon: 'text-warning',
    border: 'border-warning/30',
  },
};

/* ------------------------------------------------------------------ */
/*  Reducer                                                            */
/* ------------------------------------------------------------------ */

function toastReducer(state: ToastItem[], action: ToastAction): ToastItem[] {
  switch (action.kind) {
    case 'ADD': {
      const next = [action.toast, ...state];
      // Hard-cap: keep only the newest MAX_VISIBLE items
      return next.slice(0, MAX_VISIBLE);
    }
    case 'DISMISS':
      return state.map((t) =>
        t.id === action.id ? { ...t, exiting: true } : t,
      );
    case 'REMOVE':
      return state.filter((t) => t.id !== action.id);
    default:
      return state;
  }
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

const ToastContext = createContext<ToastContextValue | null>(null);

/* ------------------------------------------------------------------ */
/*  Individual Toast                                                   */
/* ------------------------------------------------------------------ */

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const Icon = ICON_MAP[item.type];
  const colors = COLOR_MAP[item.type];
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (item.duration > 0) {
      timerRef.current = setTimeout(() => onDismiss(item.id), item.duration);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [item.id, item.duration, onDismiss]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={[
        'pointer-events-auto flex w-[calc(100vw-2rem)] sm:w-80 max-w-sm items-start gap-3 rounded-lg border p-4 shadow-premium backdrop-blur-glass',
        'bg-card/95',
        colors.border,
        item.exiting ? 'animate-slide-out-right' : 'animate-slide-in-right',
      ].join(' ')}
    >
      <div className={`mt-0.5 flex-shrink-0 rounded-full p-1 ${colors.bg}`}>
        <Icon className={`h-4 w-4 ${colors.icon}`} />
      </div>

      <div className="flex-1 min-w-0">
        {item.title && (
          <p className="text-sm font-semibold text-card-foreground">
            {item.title}
          </p>
        )}
        <p className="text-sm text-muted-foreground leading-snug">{item.message}</p>
      </div>

      <button
        onClick={() => onDismiss(item.id)}
        className="flex-shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, dispatch] = useReducer(toastReducer, []);

  const dismiss = useCallback((id: string) => {
    dispatch({ kind: 'DISMISS', id });
    // Remove from DOM after exit animation completes
    setTimeout(() => {
      dispatch({ kind: 'REMOVE', id });
    }, EXIT_ANIMATION_MS);
  }, []);

  const toast = useCallback(
    (message: string, options: ToastOptions = {}): string => {
      const id = nextId();
      const item: ToastItem = {
        id,
        type: options.type ?? 'info',
        message,
        title: options.title,
        duration: options.duration ?? 5000,
      };
      dispatch({ kind: 'ADD', toast: item });
      return id;
    },
    [],
  );

  const contextValue = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      {/* Toast container — fixed bottom-right */}
      <div
        aria-label="Notifications"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider>');
  }
  return ctx;
}
