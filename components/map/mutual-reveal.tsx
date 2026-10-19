'use client';

import { useEffect, useState } from 'react';

/**
 * "It's mutual" reveal (FEATURES §4): a white flash, grayscale confetti, then the card. Confetti is
 * drawn as inline SVG marks rather than emoji (CLAUDE.md: no emoji in UI). Auto-dismisses.
 */
const MARKS = Array.from({ length: 22 }, (_, i) => ({
  x: (i * 37) % 100,
  delay: (i * 90) % 900,
  size: 6 + ((i * 7) % 8),
  kind: i % 3,
}));

export function MutualReveal({ name, onClose }: { name: string; onClose: () => void }) {
  const [flash, setFlash] = useState(true);
  useEffect(() => {
    const a = setTimeout(() => setFlash(false), 450);
    const b = setTimeout(onClose, 6000);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="It's mutual"
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-black/70 px-6"
      onClick={onClose}
    >
      {flash && <div aria-hidden className="pointer-events-none absolute inset-0 bg-white animate-[piFade_.45s_ease-out_both]" />}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {MARKS.map((m, i) => (
          <svg
            key={i}
            width={m.size}
            height={m.size}
            viewBox="0 0 10 10"
            className="absolute top-0 animate-[piFall_2.4s_ease-in_both] text-white/70"
            style={{ left: `${m.x}%`, animationDelay: `${m.delay}ms`, filter: 'grayscale(1)' }}
          >
            {m.kind === 0 && <circle cx="5" cy="5" r="4" fill="currentColor" />}
            {m.kind === 1 && <rect x="1" y="1" width="8" height="8" rx="2" fill="currentColor" />}
            {m.kind === 2 && <path d="M5 0 C7 3 9 5 5 10 C1 5 3 3 5 0Z" fill="currentColor" />}
          </svg>
        ))}
      </div>
      <div className="glass relative flex w-full max-w-[320px] flex-col items-center gap-3 rounded-hero px-6 py-7 text-center">
        <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-fg-3">It&apos;s mutual</p>
        <p className="text-[22px] font-semibold tracking-[-0.02em]">{name}</p>
        <p className="text-[13px] text-fg-3">You both said yes. Say hi while you&apos;re both free.</p>
        <button type="button" onClick={onClose} className="btn-primary mt-1 w-full bg-green hover:bg-green-hover">
          Keep looking
        </button>
      </div>
    </div>
  );
}
