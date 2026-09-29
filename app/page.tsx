import Link from 'next/link';
import { LogoTile, Wordmark } from '@/components/logo';

const FOOTER = [
  ['Terms', '/help/terms'],
  ['Privacy', '/help/privacy'],
  ['Community Guidelines', '/help/guidelines'],
  ['Safety', '/help/safety'],
  ['Report Content', '/help/report'],
  ['18 U.S.C. § 2257', '/help/2257'],
] as const;

/**
 * Homepage — Phase 0 shell. Globe (Three.js), chat sign-up, consent gate and face check arrive in Phase 1.
 * Layout already matches the spec: globe and chat side by side ≥1100px, stacked below, chat is the focus on mobile.
 */
export default function HomePage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* Globe stand-in: rings + halo, never competing with the chat card */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[38%] h-[120vw] max-h-[900px] w-[120vw] max-w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(52,211,153,0.10),rgba(52,211,153,0.03)_45%,transparent_62%)] lg:left-[30%]" />
        {[0.55, 0.7, 0.85].map((s) => (
          <div
            key={s}
            className="absolute left-1/2 top-[38%] rounded-full border border-line-1 lg:left-[30%]"
            style={{ width: `${s * 100}vmin`, height: `${s * 100}vmin`, transform: 'translate(-50%,-50%)' }}
          />
        ))}
      </div>

      <header className="relative z-10 flex items-center gap-3 px-4 pt-[calc(16px+var(--safe-top))] sm:px-8 sm:pt-6">
        <LogoTile />
        <div className="flex flex-col leading-none">
          <Wordmark />
          <span className="mt-1 text-[12px] text-fg-3">Know who’s ready.</span>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-end px-4 pb-6 pt-8 sm:px-8 lg:flex-row lg:items-center lg:justify-end lg:pr-16">
        <section
          aria-label="Sign up"
          className="glass w-full max-w-[420px] animate-in rounded-hero p-5 shadow-float sm:p-6"
        >
          <div className="mb-4 flex items-center gap-2">
            <span className="text-[15px] font-semibold">πroka</span>
            <span className="flex items-center gap-1.5 text-[12px] text-fg-3">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green" /> Online
            </span>
          </div>
          <div className="mb-5 flex flex-col gap-2">
            <p className="max-w-[88%] rounded-[16px] rounded-bl-[6px] bg-ink-800 px-3.5 py-2.5 text-[14px] text-fg-2">
              Hey. πroka is a live map of who’s ready near you. 18+ only.
            </p>
            <p className="max-w-[88%] rounded-[16px] rounded-bl-[6px] bg-ink-800 px-3.5 py-2.5 text-[14px] text-fg-2">
              How do you want to get in?
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <button type="button" className="btn-primary w-full">
              Continue with Google
            </button>
            <button
              type="button"
              className="btn-secondary w-full border-none bg-black text-white hover:bg-ink-800"
            >
              Continue with Apple
            </button>
            <button type="button" className="btn-ghost w-full">
              Use Email Instead
            </button>
            <button type="button" className="btn-ghost w-full">
              Continue Anonymously
            </button>
          </div>
          <p className="mt-4 text-center text-[12px] text-fg-4">
            Already here?{' '}
            <Link
              href="/account/magic"
              className="text-fg-2 underline-offset-2 hover:text-green-hover hover:underline"
            >
              Log in
            </Link>
          </p>
        </section>
      </main>

      <footer className="relative z-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 px-4 pb-[calc(16px+var(--safe-bottom))] text-[11px] text-fg-4 sm:px-8">
        {FOOTER.map(([label, href]) => (
          <Link key={href} href={href} className="hover:text-fg-2">
            {label}
          </Link>
        ))}
        <span className="w-full text-center text-[10px] text-fg-4/70 sm:w-auto">
          © OpenStreetMap contributors · Esri, HERE, Garmin
        </span>
      </footer>
    </div>
  );
}
