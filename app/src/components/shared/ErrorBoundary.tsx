'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex items-center justify-center min-h-[60vh] p-8">
          <div
            className="relative w-full max-w-md rounded-2xl border border-border p-8 text-center"
            style={{
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            {/* Error icon */}
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-error/10">
              <svg
                className="h-8 w-8 text-error"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                />
              </svg>
            </div>

            <h2 className="text-xl font-medium text-foreground mb-2">
              Something went wrong
            </h2>
            <p className="text-sm font-light text-foreground-secondary mb-6">
              An unexpected error occurred. Try refreshing the page or click below to retry.
            </p>

            {/* Error details (collapsed) */}
            {this.state.error && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-xs text-foreground-secondary hover:text-foreground transition-colors">
                  Error details
                </summary>
                <pre className="mt-2 rounded-xl bg-glass border border-glass-border p-3 text-xs font-mono text-foreground-secondary overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              </details>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleRetry}
                className="flex-1 py-3 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-primary to-accent shadow-md hover:shadow-lg transition-all"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 py-3 rounded-xl text-sm font-medium text-foreground-secondary bg-glass border border-glass-border hover:bg-white/10 transition-all"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
