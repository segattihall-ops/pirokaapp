'use client';

import { useEffect, useRef, useState } from 'react';
import { submitAgeCheck } from '@/lib/auth/client';
import type { Session } from '@/lib/auth/types';

/** Persona's browser SDK. Pinned version so a silent upstream change can't alter the flow. */
const PERSONA_SDK = 'https://cdn.withpersona.com/dist/persona-v5.4.0.js';

type PersonaClient = { open: () => void; destroy?: () => void };
type PersonaGlobal = {
  Client: new (options: {
    inquiryId: string;
    environmentId: string;
    onReady: () => void;
    onComplete: (args: { inquiryId: string }) => void;
    onCancel?: () => void;
    onError?: (error: unknown) => void;
  }) => PersonaClient;
};

declare global {
  interface Window {
    Persona?: PersonaGlobal;
  }
}

function loadSdk(): Promise<PersonaGlobal> {
  if (window.Persona) return Promise.resolve(window.Persona);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PERSONA_SDK;
    script.async = true;
    script.onload = () =>
      window.Persona ? resolve(window.Persona) : reject(new Error('Persona did not load'));
    script.onerror = () => reject(new Error('Could not load the age check'));
    document.head.appendChild(script);
  });
}

/**
 * Runs the age check with whichever provider the server is configured for.
 * Didit: hosted page; we redirect there and it sends the user back to /age/return.
 * Persona: embedded flow; the result is confirmed on the server before the session updates.
 */
export function AgeCheck({ onVerified }: { onVerified: (session: Session) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const clientRef = useRef<PersonaClient | null>(null);

  useEffect(() => () => clientRef.current?.destroy?.(), []);

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/age/start', { method: 'POST' });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Could not start the age check');
      const started = (await r.json()) as
        | { provider: 'didit'; url: string; sessionId: string }
        | { provider: 'persona'; inquiryId: string };

      if (started.provider === 'didit') {
        try {
          sessionStorage.setItem('piroka_age_session', started.sessionId);
        } catch {}
        window.location.assign(started.url);
        return;
      }

      const environmentId = process.env.NEXT_PUBLIC_PERSONA_ENVIRONMENT_ID;
      if (!environmentId) throw new Error('Age check is not configured');
      const { inquiryId } = started;

      const Persona = await loadSdk();
      clientRef.current = new Persona.Client({
        inquiryId,
        environmentId,
        onReady: () => clientRef.current?.open(),
        onComplete: async ({ inquiryId: done }) => {
          try {
            onVerified(await submitAgeCheck('id', done));
          } catch (e) {
            setError(e instanceof Error ? e.message : 'The age check did not pass.');
          } finally {
            setBusy(false);
          }
        },
        onCancel: () => setBusy(false),
        onError: () => {
          setError('The age check was interrupted. Try again.');
          setBusy(false);
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the age check');
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="h-11 rounded-input bg-white text-[14px] font-semibold text-ink-950 disabled:opacity-60"
      >
        {busy ? 'Opening the age check…' : 'Start age check'}
      </button>
      {error && <span className="text-[12px] text-fg-3">{error}</span>}
    </div>
  );
}
