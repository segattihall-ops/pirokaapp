'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export function ErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { location: 'error-boundary' },
    });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="max-w-md text-center">
        <h1 className="mb-4 text-4xl font-bold text-white">Something went wrong</h1>
        <p className="mb-6 text-slate-300">{error.message || 'An unexpected error occurred'}</p>
        <button
          onClick={reset}
          className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
