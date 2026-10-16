'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { submitAgeCheck } from '@/lib/auth/client';
import { AFTER_GATE_PATH, GATE_PATH } from '@/lib/auth/types';
import { LogoTile } from '@/components/logo';

const KEY = 'piroka_age_session';

/** Didit sends the user back here. The server re-checks the session before opening the app. */
function Return() {
  const router = useRouter();
  const params = useSearchParams();
  const [state, setState] = useState<'checking' | 'review' | 'failed' | 'other-device'>('checking');
  const [error, setError] = useState('');

  useEffect(() => {
    let sessionId = params.get('verificationSessionId') ?? params.get('session_id');
    try {
      sessionId = sessionId ?? sessionStorage.getItem(KEY);
    } catch {}
    if (!sessionId) {
      setState('failed');
      setError('We could not find your age check. Please start it again.');
      return;
    }
    submitAgeCheck('face', sessionId)
      .then(() => {
        try {
          sessionStorage.removeItem(KEY);
        } catch {}
        router.replace(AFTER_GATE_PATH);
      })
      .catch((e: Error) => {
        if (/review/i.test(e.message)) setState('review');
        // Finished on a device that isn't signed in (e.g. the phone after scanning a computer's QR code):
        // the check itself went through and the webhook grants access to the account that started it.
        else if (/not signed in/i.test(e.message)) setState('other-device');
        else {
          setState('failed');
          setError(e.message);
        }
      });
  }, [params, router]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-[400px] flex-col items-center justify-center gap-4 px-4 text-center text-fg">
      <LogoTile size={48} />
      {state === 'checking' && <p className="text-[15px]">Confirming your age check…</p>}
      {state === 'review' && (
        <>
          <h1 className="text-h2">Almost there</h1>
          <p className="text-[14px] text-fg-3">
            Your check needs a quick manual review. You&apos;ll get access automatically once it&apos;s
            approved — usually within minutes.
          </p>
        </>
      )}
      {state === 'other-device' && (
        <>
          <h1 className="text-h2">Check sent</h1>
          <p className="text-[14px] text-fg-3">
            Your age check went through. Go back to the device where you started it. It will open
            automatically once it is approved.
          </p>
        </>
      )}
      {state === 'failed' && (
        <>
          <h1 className="text-h2">Age check not completed</h1>
          <p className="text-[14px] text-fg-3">{error}</p>
          <Link href={GATE_PATH} className="btn-primary">
            Try again
          </Link>
        </>
      )}
    </div>
  );
}

export default function AgeReturnPage() {
  return (
    <Suspense>
      <Return />
    </Suspense>
  );
}
