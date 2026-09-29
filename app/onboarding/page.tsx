import type { Metadata } from 'next';
import Link from 'next/link';
import { LogoTile, Wordmark } from '@/components/logo';

export const metadata: Metadata = { title: 'Onboarding' };

const STEPS = ['How you show up', 'Who you are', 'Who you want to see', 'Photos', 'Location & privacy'];

/**
 * Onboarding — Phase 0 shell: 560px column, 5-segment progress bar, glass card, sticky Back/Continue.
 * Step content arrives in Phase 2 (design_handoff/design/Piroka Onboarding.dc.html).
 */
export default function OnboardingPage() {
  const step = 1;
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col px-4 pt-[calc(16px+var(--safe-top))] sm:px-6">
      <header className="flex items-center gap-3">
        <LogoTile />
        <Wordmark />
        <span className="ml-auto text-[12px] text-fg-3">
          Step {step} of {STEPS.length}
        </span>
      </header>

      <ol className="mt-4 flex gap-1.5" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={`h-[3px] flex-1 rounded-full ${i < step ? 'bg-green' : 'bg-line-2'}`}
            aria-current={i + 1 === step ? 'step' : undefined}
          >
            <span className="sr-only">{s}</span>
          </li>
        ))}
      </ol>

      <section className="glass mt-6 flex-1 animate-in rounded-hero p-5 sm:p-7">
        <h1 className="text-h2 sm:text-h1">
          How do you want
          <br />
          to show up?
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-fg-3">
          Stay anonymous or pick a name. You can switch any time.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2.5">
          <div className="rounded-card border border-sel-border bg-sel-fill p-4">
            <div className="text-[15px] font-semibold">Display name</div>
            <div className="mt-1 text-[12px] text-fg-3">Pick a handle. Never your legal name.</div>
          </div>
          <div className="rounded-card border border-line-2 p-4">
            <div className="text-[15px] font-semibold">Anonymous</div>
            <div className="mt-1 text-[12px] text-fg-3">No name. Shown as “Anonymous”.</div>
          </div>
        </div>

        <label className="mt-5 block text-[12px] text-fg-3" htmlFor="display-name">
          Display name
        </label>
        <input
          id="display-name"
          className="input mt-1.5"
          placeholder="Anything but your legal name"
          disabled
        />

        <div className="mt-5 rounded-input border border-sel-border/50 bg-sel-fill px-3.5 py-2.5 text-[12px] text-green">
          ✓ Age verified 18+ — your birthday is never shown.
        </div>
      </section>

      <div className="sticky bottom-0 -mx-4 mt-4 flex gap-2.5 bg-ink-950/90 px-4 pb-[calc(16px+var(--safe-bottom))] pt-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <Link href="/" className="btn-secondary">
          Back
        </Link>
        <button type="button" className="btn-primary flex-1" disabled>
          Continue
        </button>
      </div>
    </div>
  );
}
