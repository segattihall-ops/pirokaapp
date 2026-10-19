'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/errors/client';
import { maybeRecoverFromChunkError } from '@/lib/errors/chunk';

/** Root boundary (replaces the root layout when it crashes). Must render its own <html>/<body>. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(error.message, error.stack, { digest: error.digest, boundary: 'global' });
    maybeRecoverFromChunkError(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{ margin: 0, background: '#070707', color: '#eaeaea', fontFamily: 'system-ui, sans-serif' }}
      >
        <div
          style={{
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: 16,
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: 22, margin: 0 }}>πroka hit a wall.</h1>
          <p style={{ color: '#999', maxWidth: 360, margin: 0 }}>The error is logged. Reload to continue.</p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: '#34d399',
              color: '#070707',
              border: 0,
              borderRadius: 12,
              padding: '10px 18px',
              fontWeight: 700,
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
