'use client';

import { useEffect } from 'react';

/** Leaves πroka for a neutral page without a history entry. */
export function quickExit() {
  window.location.replace('https://www.google.com/search?q=weather');
}

const ESC_WINDOW_MS = 1500;

/**
 * Quick exit everywhere: Esc pressed twice within 1.5 s on any screen, plus a shield button on
 * phones (the desktop rail has its own). Mounted once in the app shell.
 */
export function QuickExit() {
  useEffect(() => {
    let last = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const now = Date.now();
      if (now - last < ESC_WINDOW_MS) quickExit();
      last = now;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <button
      type="button"
      aria-label="Quick exit"
      onClick={quickExit}
      className="glass tap fixed right-3 top-[calc(10px+env(safe-area-inset-top))] z-40 flex h-9 w-9 items-center justify-center rounded-chip border border-line-2 text-fg-3 rail:hidden"
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z" />
      </svg>
    </button>
  );
}
