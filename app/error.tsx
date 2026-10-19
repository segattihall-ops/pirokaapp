'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { reportClientError } from '@/lib/errors/client';
import { maybeRecoverFromChunkError } from '@/lib/errors/chunk';

/** Route-segment error boundary: reports once, offers retry. A stale chunk after a deploy self-heals with a reload. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(error.message, error.stack, { digest: error.digest, boundary: 'route' });
    maybeRecoverFromChunkError(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center text-fg">
      <h1 className="text-h2">Something broke.</h1>
      <p className="max-w-[360px] text-[14px] text-fg-3">
        We’ve logged it. Try again, or head back to the map.
        {error.digest ? <span className="block text-[11px] text-fg-4">ref {error.digest}</span> : null}
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={reset} className="btn-primary">
          Try again
        </button>
        <Link href="/app/map" className="btn-secondary">
          Back to πroka
        </Link>
      </div>
    </div>
  );
}
