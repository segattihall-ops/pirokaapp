'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { LogoTile } from '@/components/logo';

/** Didit sends the member back here after a selfie face-match. We confirm with the server, then ME. */
function Return() {
  const router = useRouter();
  const params = useSearchParams();
  const [state, setState] = useState<'checking' | 'review' | 'failed' | 'other-device'>('checking');
  const [error, setError] = useState('');

  useEffect(() => {
    const sessionId = params.get('verificationSessionId') ?? params.get('session_id');
    if (!sessionId) {
      setState('failed');
      setError('We could not find your photo check. Please start it again.');
      return;
    }
    fetch('/api/me/photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm', sessionId }),
    })
      .then(async (r) => {
        if (r.ok) return router.replace('/app/me');
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        // Finished on a device that isn't signed in (phone after scanning a computer's QR): the
        // webhook still grants the badge on the account that started it.
        if (r.status === 401) setState('other-device');
        else if (/not approved yet/i.test(j.error ?? '')) setState('review');
        else {
          setState('failed');
          setError(j.error ?? 'Your photo check could not be completed.');
        }
      })
      .catch(() => {
        setState('failed');
        setError('Your photo check could not be completed.');
      });
  }, [params, router]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-[400px] flex-col items-center justify-center gap-4 px-4 text-center text-fg">
      <LogoTile size={48} />
      {state === 'checking' && <p className="text-[15px]">Confirming your photo check…</p>}
      {state === 'review' && (
        <>
          <h1 className="text-h2">Almost there</h1>
          <p className="text-[14px] text-fg-3">
            Your photo check needs a moment. The badge appears automatically once it&apos;s approved.
          </p>
          <Link href="/app/me" className="btn-primary">
            Back to profile
          </Link>
        </>
      )}
      {state === 'other-device' && (
        <>
          <h1 className="text-h2">Check sent</h1>
          <p className="text-[14px] text-fg-3">
            Your photo check went through. Go back to the device where you started it — the badge appears
            automatically once it is approved.
          </p>
        </>
      )}
      {state === 'failed' && (
        <>
          <h1 className="text-h2">Photo check not completed</h1>
          <p className="text-[14px] text-fg-3">{error}</p>
          <Link href="/app/me" className="btn-primary">
            Back to profile
          </Link>
        </>
      )}
    </div>
  );
}

export default function PhotoReturnPage() {
  return (
    <Suspense>
      <Return />
    </Suspense>
  );
}
