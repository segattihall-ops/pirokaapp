'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Declaratory 18+ entry screen. A visible age barrier shown before any content on a visitor's first
 * arrival — the door everyone (including an anonymous entry) passes through. The visitor selects a
 * date of birth and may only enter when it computes to 18+. This is a self-attestation, NOT the real
 * age gate: participation (chat, posting, becoming visible, a real account) still requires full Didit
 * age/ID verification. We store only an acknowledgement flag in `piroka_age_ack` for a year — never
 * the date of birth. The server reads that cookie in the root layout and passes
 * `initiallyAcknowledged`, so there is no flash of content behind it and none of the screen for
 * returning visitors. Clearing site data re-shows it.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function ageFrom(y: number, m: number, d: number): number {
  const now = new Date();
  let age = now.getFullYear() - y;
  const beforeBirthday =
    now.getMonth() < m - 1 || (now.getMonth() === m - 1 && now.getDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

export function AgeNotice({ initiallyAcknowledged }: { initiallyAcknowledged: boolean }) {
  const [acknowledged, setAcknowledged] = useState(initiallyAcknowledged);
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [year, setYear] = useState('');
  const firstRef = useRef<HTMLSelectElement>(null);

  const thisYear = new Date().getFullYear();
  const years = useMemo(
    () => Array.from({ length: 100 }, (_, i) => thisYear - 18 + 2 - i).filter((y) => y <= thisYear),
    [thisYear],
  );

  useEffect(() => {
    if (acknowledged) return;
    firstRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [acknowledged]);

  if (acknowledged) return null;

  const complete = Boolean(month && day && year);
  const age = complete ? ageFrom(Number(year), Number(month), Number(day)) : null;
  const adult = age !== null && age >= 18;
  const underage = complete && !adult;

  const enter = () => {
    if (!adult) return;
    // One year, site-wide. Lax so it survives normal navigation; cleared site data re-shows it.
    document.cookie = `piroka_age_ack=1; path=/; max-age=31536000; SameSite=Lax`;
    setAcknowledged(true);
  };

  const selectClass =
    'h-12 w-full appearance-none rounded-input bg-ink-800 px-3 text-[15px] text-fg ring-1 ring-line-2 focus:outline-none focus:ring-sel-border';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-notice-title"
      className="fixed inset-0 z-[100] overflow-hidden bg-ink-950"
    >
      {/* Brand ambience: a soft green glow and a faint map-grid motif behind the card. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(90% 60% at 50% 8%, rgba(52,211,153,0.16), transparent 60%), radial-gradient(70% 50% at 85% 100%, rgba(255,255,255,0.05), transparent 55%)',
        }}
      />
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full text-fg"
        style={{ opacity: 0.04 }}
      >
        <defs>
          <pattern id="agegrid" width="44" height="44" patternUnits="userSpaceOnUse">
            <path d="M44 0H0V44" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#agegrid)" />
      </svg>

      <div className="relative flex min-h-full items-end justify-center px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-8 sm:items-center">
        <div className="w-full max-w-[440px] rounded-hero bg-glass bg-ink-900/80 p-7 shadow-float ring-1 ring-line-2 backdrop-blur-xl">
          <div className="flex flex-col items-center text-center">
            <span
              aria-hidden="true"
              className="flex h-14 w-14 items-center justify-center rounded-hero bg-logo text-[26px] font-bold text-fg shadow-glow ring-1 ring-line-3"
            >
              π
            </span>
            <p className="mt-3 text-[12px] font-bold uppercase tracking-[0.18em] text-fg-3">πroka</p>
            <h1
              id="age-notice-title"
              className="mt-3 text-[26px] font-semibold leading-[1.15] tracking-[-0.02em] text-fg"
            >
              Are you 18 or older?
            </h1>
            <p className="mt-2 text-[14px] leading-[1.55] text-fg-2">
              πroka is an adults-only community for queer adults. Enter your date of birth to continue.
            </p>
          </div>

          <div className="mt-6">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">
              Date of birth
            </p>
            <div className="grid grid-cols-[1.2fr_0.8fr_1fr] gap-2">
              <select
                ref={firstRef}
                aria-label="Birth month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className={selectClass}
              >
                <option value="">Month</option>
                {MONTHS.map((label, i) => (
                  <option key={label} value={String(i + 1)}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Birth day"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className={selectClass}
              >
                <option value="">Day</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={String(d)}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                aria-label="Birth year"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className={selectClass}
              >
                <option value="">Year</option>
                {years.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {underage && (
              <p role="alert" className="mt-3 text-[13px] leading-[1.5] text-warning">
                You must be 18 or older to use πroka.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={enter}
            disabled={!adult}
            className="mt-6 h-12 w-full rounded-btn bg-green text-[15px] font-semibold text-ink-950 transition-colors hover:bg-green-hover disabled:cursor-not-allowed disabled:bg-ink-750 disabled:text-fg-4"
          >
            Enter πroka
          </button>
          <a
            href="https://www.google.com"
            className="mt-2 flex h-11 w-full items-center justify-center rounded-btn text-[14px] font-medium text-fg-3 hover:text-fg-2"
          >
            Leave
          </a>

          <p className="mt-5 text-center text-[12px] leading-[1.5] text-fg-4">
            By entering you agree to our{' '}
            <a className="underline hover:text-fg-3" href="/help/terms">
              Terms
            </a>{' '}
            and{' '}
            <a className="underline hover:text-fg-3" href="/help/privacy">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
