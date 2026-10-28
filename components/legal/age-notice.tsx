'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LiveMap } from '@/components/home/live-map';
import { useGeo } from '@/components/home/use-geo';

/**
 * Declaratory 18+ entry screen, styled like the homepage: the live map behind the same ink gradients
 * and green glow, with a glass sheet carrying a date-of-birth selector. The visitor may only enter
 * when the date computes to 18+. This is a self-attestation, NOT the real age gate — participation
 * (chat, posting, becoming visible, a real account) still requires full Didit age/ID verification.
 * We store only an acknowledgement flag in `piroka_age_ack` for a year, never the date of birth. The
 * server reads that cookie in the root layout and passes `initiallyAcknowledged`, so there is no
 * flash of content behind it and none of the screen for returning visitors.
 */

function ageFrom(y: number, m: number, d: number): number {
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() < m - 1 || (now.getMonth() === m - 1 && now.getDate() < d)) age -= 1;
  return age;
}

export function AgeNotice({ initiallyAcknowledged }: { initiallyAcknowledged: boolean }) {
  const [acknowledged, setAcknowledged] = useState(initiallyAcknowledged);
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [year, setYear] = useState('');
  const firstRef = useRef<HTMLSelectElement>(null);
  const { geo } = useGeo();
  const t = useTranslations('ageGate');
  const MONTHS = t.raw('months') as string[];

  const thisYear = new Date().getFullYear();
  const years = useMemo(() => Array.from({ length: 100 }, (_, i) => thisYear - 16 - i), [thisYear]);

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
      className="fixed inset-0 z-[100] overflow-hidden text-fg"
      style={{
        background: 'radial-gradient(ellipse 80% 70% at 72% 50%, #111111 0%, #0a0a0a 45%, #070707 100%)',
      }}
    >
      {/* Homepage background: the live map behind the same ink fade and green glow. */}
      <LiveMap geo={geo} />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(0deg, rgba(7,7,7,0.94) 2%, rgba(7,7,7,0.55) 34%, rgba(7,7,7,0.25) 100%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-[25vh] -left-[12vw] h-[75vh] w-[62vw]"
        style={{ background: 'radial-gradient(closest-side, rgba(52,211,153,0.12), rgba(52,211,153,0) 72%)' }}
      />

      <div className="relative z-[1] flex h-full flex-col">
        <header className="flex items-center justify-between gap-3 px-5 pt-[calc(16px+var(--safe-top,0px))]">
          <div className="flex items-center gap-2.5">
            <div
              className="relative flex h-[34px] w-[34px] items-center justify-center rounded-[11px] border border-[rgba(255,255,255,0.14)] text-[19px] font-bold leading-none text-fg"
              style={{
                background: 'linear-gradient(160deg, #1a1a1a 0%, #070707 60%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 6px 18px rgba(0,0,0,0.5)',
              }}
            >
              π
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-green shadow-[0_0_8px_#34d399]" />
            </div>
            <span className="text-[18px] font-bold tracking-[-0.03em]">πroka</span>
          </div>
          <span className="flex items-center gap-1.5 rounded-chip border border-line-2 bg-white/[0.04] px-3 py-1.5 text-[12px] text-fg-3">
            <span className="font-semibold text-fg">18+</span>
            <span>{t('adultsOnly')}</span>
          </span>
        </header>

        <div className="flex min-h-0 flex-1 items-end justify-center px-4 pb-[max(20px,var(--safe-bottom,16px))] pt-6 sm:items-center">
          <div className="w-full max-w-[440px] rounded-hero bg-ink-900/70 bg-glass p-7 shadow-float ring-1 ring-line-2 backdrop-blur-xl">
            <h1
              id="age-notice-title"
              className="text-[27px] font-semibold leading-[1.12] tracking-[-0.03em] text-fg"
            >
              {t('headline')}
            </h1>
            <p className="mt-2 text-[14px] leading-[1.55] text-fg-2">{t('intro')}</p>

            <p className="mb-2 mt-6 text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">
              {t('dob')}
            </p>
            <div className="grid grid-cols-[1.2fr_0.8fr_1fr] gap-2">
              <select
                ref={firstRef}
                aria-label={t('birthMonth')}
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className={selectClass}
              >
                <option value="">{t('month')}</option>
                {MONTHS.map((label, i) => (
                  <option key={label} value={String(i + 1)}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                aria-label={t('birthDay')}
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className={selectClass}
              >
                <option value="">{t('day')}</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={String(d)}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                aria-label={t('birthYear')}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className={selectClass}
              >
                <option value="">{t('year')}</option>
                {years.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {underage && (
              <p role="alert" className="mt-3 text-[13px] leading-[1.5] text-warning">
                {t('underage')}
              </p>
            )}

            <button
              type="button"
              onClick={enter}
              disabled={!adult}
              className="mt-6 h-12 w-full rounded-btn bg-green text-[15px] font-semibold text-ink-950 transition-colors hover:bg-green-hover disabled:cursor-not-allowed disabled:bg-ink-750 disabled:text-fg-4"
            >
              {t('enter')}
            </button>
            <a
              href="https://www.google.com"
              className="mt-2 flex h-11 w-full items-center justify-center rounded-btn text-[14px] font-medium text-fg-3 hover:text-fg-2"
            >
              {t('leave')}
            </a>

            <p className="mt-5 text-center text-[12px] leading-[1.5] text-fg-4">
              {t.rich('agree', {
                terms: (chunks) => (
                  <a className="underline hover:text-fg-3" href="/help/terms">
                    {chunks}
                  </a>
                ),
                privacy: (chunks) => (
                  <a className="underline hover:text-fg-3" href="/help/privacy">
                    {chunks}
                  </a>
                ),
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
