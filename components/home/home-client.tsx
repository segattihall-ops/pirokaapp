'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Intro } from './intro';
import { LiveMap } from './live-map';
import { SignupChat } from './signup-chat';
import { useGeo } from './use-geo';

const FOOTER = [
  ['Terms', '/help/terms'],
  ['Privacy', '/help/privacy'],
  ['Community Guidelines', '/help/guidelines'],
  ['Safety', '/help/safety'],
  ['Report Content', '/help/report'],
  ['18 U.S.C. § 2257', '/help/2257'],
] as const;

export function HomeClient({ gated, demo }: { gated: boolean; demo: boolean }) {
  const { geo, label, precise, requestPrecise } = useGeo();
  // Intro plays once per session, never under reduced motion, and never on a gate redirect.
  const [intro, setIntro] = useState(false);
  useEffect(() => {
    if (gated) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    try {
      if (sessionStorage.getItem('piroka_intro')) return;
      sessionStorage.setItem('piroka_intro', '1');
    } catch {}
    setIntro(true);
  }, [gated]);

  return (
    <div
      className="relative h-dvh overflow-hidden text-fg lg:h-auto lg:min-h-dvh"
      style={{
        background: 'radial-gradient(ellipse 80% 70% at 72% 50%, #111111 0%, #0a0a0a 45%, #070707 100%)',
      }}
    >
      <LiveMap geo={geo} />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(7,7,7,0.92) 0%, rgba(7,7,7,0.55) 38%, rgba(7,7,7,0) 62%), linear-gradient(0deg, rgba(7,7,7,0.9) 0%, rgba(7,7,7,0) 22%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed -bottom-[25vh] -left-[12vw] z-0 h-[75vh] w-[62vw]"
        style={{ background: 'radial-gradient(closest-side, rgba(52,211,153,0.11), rgba(52,211,153,0) 72%)' }}
      />

      <div className="relative z-[1] flex h-dvh min-h-0 flex-col lg:h-auto lg:min-h-dvh">
        <header className="flex animate-[piIn_.7s_ease-out_both] items-center justify-between gap-4 px-[clamp(20px,5vw,64px)] pb-3 pt-[calc(14px+var(--safe-top))] lg:pb-7 lg:pt-[calc(28px+var(--safe-top))]">
          <div className="flex items-center gap-3.5">
            <div
              className="relative flex h-[38px] w-[38px] items-center justify-center rounded-[11px] border border-[rgba(255,255,255,0.14)] text-[22px] font-bold leading-none text-fg"
              style={{
                background: 'linear-gradient(160deg, #1a1a1a 0%, #070707 60%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 6px 18px rgba(0,0,0,0.5)',
              }}
            >
              π
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-green shadow-[0_0_8px_#34d399]" />
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-[21px] font-bold tracking-[-0.03em]">πroka</span>
              <span className="hidden h-3.5 w-px self-center bg-[rgba(255,255,255,0.16)] sm:block" />
              <span className="hidden text-[13px] tracking-[0.01em] text-fg-3 sm:block">
                Know who’s ready.
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={requestPrecise}
              title="Approximate area — your exact location is never shown"
              className="flex min-h-[40px] items-center gap-[7px] whitespace-nowrap rounded-chip border border-line-2 bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-fg-3 transition-colors hover:border-[rgba(52,211,153,0.45)] hover:text-fg"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#34d399"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
                <circle cx="12" cy="9.5" r="2.5" />
              </svg>
              <span>{label}</span>
              {!precise && <span className="text-green">· Use precise</span>}
            </button>
            <div className="flex items-center gap-2 rounded-chip border border-line-2 px-3 py-1.5 text-[12px] text-fg-3">
              <span className="font-semibold text-fg">18+</span>
              <span>Adults only</span>
            </div>
            {demo && (
              <span
                title="No Supabase keys configured — auth runs on a local demo cookie"
                className="rounded-chip border border-warning/40 bg-warning/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-warning"
              >
                Demo auth
              </span>
            )}
          </div>
        </header>

        {/* Mobile: the card hugs the bottom so the map stays in view and nothing scrolls. */}
        <main className="flex min-h-0 flex-1 flex-col justify-end px-[clamp(16px,5vw,64px)] pb-2 pt-1 lg:justify-center lg:pb-8 lg:pt-2">
          <SignupChat gated={gated} />
        </main>

        <footer className="flex shrink-0 flex-col gap-1 px-[clamp(20px,5vw,64px)] pb-[calc(8px+var(--safe-bottom))] pt-1 text-[11px] text-fg-3 lg:gap-3 lg:pb-[calc(24px+var(--safe-bottom))] lg:pt-2 lg:text-[12px]">
          <nav className="flex flex-wrap items-center gap-x-3 gap-y-1 lg:gap-x-4 lg:gap-y-1.5">
            {FOOTER.map(([l, h]) => (
              <Link key={h} href={h} className="tap-link hover:text-green">
                {l}
              </Link>
            ))}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
              className="tap-link text-fg-4 hover:text-fg-3"
            >
              © OpenStreetMap contributors
            </a>
            <span className="text-fg-4">Esri, HERE, Garmin</span>
          </nav>
          <div className="hidden items-center gap-2 text-fg-4 lg:flex">
            <span className="rounded-[6px] border border-line-2 px-1.5 py-0.5 text-[11px] font-semibold text-fg-2">
              18+
            </span>
            <span>You must be 18 or older to enter. © 2026 πroka</span>
          </div>
        </footer>
      </div>

      {intro && <Intro onDone={() => setIntro(false)} />}
    </div>
  );
}
