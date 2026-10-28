'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Declaratory 18+ entry notice. A visible, one-tap age barrier shown before any content on a
 * visitor's first arrival — the optics barrier adult platforms carry. It is NOT the real age gate:
 * participation (chat, posting, becoming visible, a real account) still requires full Didit age/ID
 * verification. Acknowledgement is remembered in the `piroka_age_ack` cookie for a year; the server
 * reads that cookie in the root layout and passes `initiallyAcknowledged`, so there is no flash of
 * content behind the notice and no flash of the notice for returning visitors.
 */
export function AgeNotice({ initiallyAcknowledged }: { initiallyAcknowledged: boolean }) {
  const [acknowledged, setAcknowledged] = useState(initiallyAcknowledged);
  const enterRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (acknowledged) return;
    enterRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [acknowledged]);

  if (acknowledged) return null;

  const enter = () => {
    // One year, site-wide. Lax so it survives normal navigation; cleared site data re-shows it.
    document.cookie = `piroka_age_ack=1; path=/; max-age=31536000; SameSite=Lax`;
    setAcknowledged(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-notice-title"
      className="fixed inset-0 z-[100] flex items-end justify-center bg-ink-950/90 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-6 sm:items-center"
    >
      <div className="w-full max-w-[420px] rounded-sheet bg-ink-900 p-6 shadow-sheet ring-1 ring-line-2">
        <div className="mb-4 flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-logo bg-logo text-[18px] font-bold text-fg"
          >
            π
          </span>
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-fg">πroka</span>
        </div>

        <h1 id="age-notice-title" className="text-[20px] font-semibold leading-[1.25] tracking-[-0.02em] text-fg">
          You must be 18 or older
        </h1>
        <p className="mt-2 text-[14px] leading-[1.55] text-fg-2">
          πroka is an adults-only community for queer adults. By entering, you confirm that you are
          at least 18 years old and agree to our Terms and Privacy Policy.
        </p>

        <button
          ref={enterRef}
          type="button"
          onClick={enter}
          className="mt-5 h-12 w-full rounded-btn bg-green text-[15px] font-semibold text-ink-950 hover:bg-green-hover"
        >
          I am 18 or older — enter
        </button>
        <a
          href="https://www.google.com"
          className="mt-2 flex h-11 w-full items-center justify-center rounded-btn text-[14px] font-medium text-fg-3 hover:text-fg-2"
        >
          Leave
        </a>

        <p className="mt-4 text-[12px] leading-[1.5] text-fg-4">
          <a className="underline hover:text-fg-3" href="/help/terms">
            Terms
          </a>
          {' · '}
          <a className="underline hover:text-fg-3" href="/help/privacy">
            Privacy
          </a>
          {' · '}
          <a className="underline hover:text-fg-3" href="/help/guidelines">
            Community Guidelines
          </a>
        </p>
      </div>
    </div>
  );
}
