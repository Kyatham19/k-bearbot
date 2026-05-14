'use client';

import { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorState {
  hasError: boolean;
  error?: Error;
}

export function ErrorBoundary({ children }: ErrorBoundaryProps) {
  const [state, setState] = useState<ErrorState>({ hasError: false });

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      logger.error('Uncaught error', event.error, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });

      setState({
        hasError: true,
        error: event.error,
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logger.error('Unhandled promise rejection', event.reason);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  if (state.hasError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-950 to-black p-4">
        <div className="max-w-md rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur">
          <h1 className="mb-2 text-xl font-semibold text-red-400">
            Something went wrong
          </h1>
          <p className="mb-4 text-sm text-zinc-400">
            We've been notified about this error. Please try refreshing the page.
          </p>
          {process.env.NODE_ENV === 'development' && state.error && (
            <details className="mb-4 rounded bg-zinc-800/50 p-2 text-xs text-zinc-300">
              <summary className="cursor-pointer font-mono font-semibold">
                Error details
              </summary>
              <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words">
                {state.error.message}
                {'\n'}
                {state.error.stack}
              </pre>
            </details>
          )}
          <button
            onClick={() => window.location.reload()}
            className="w-full rounded bg-accent-brand px-3 py-2 text-sm font-medium text-white hover:bg-accent-brand/90 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
