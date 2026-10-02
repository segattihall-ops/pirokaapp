'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ErrorBoundary } from '@/components/error/error-boundary';
import { ZohoDeskWidget } from '@/components/support/zoho-desk-widget';
import '@/lib/monitoring/sentry.client.config';

/** Auth is Supabase (cookie session read server-side); no next-auth client provider is needed. */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 5_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );

  return (
    <ErrorBoundary error={new Error('An unexpected error occurred')} reset={() => window.location.reload()}>
      <QueryClientProvider client={client}>
        {children}
        <ZohoDeskWidget />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
