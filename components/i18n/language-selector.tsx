'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'pt-BR', label: 'Português' },
  { code: 'es', label: 'Español' },
] as const;

/**
 * ME → language. Stores the choice in the `piroka_locale` cookie (which `i18n/request.ts` reads to
 * pick messages, so no `/[locale]` route is needed), mirrors it to the profile, then refreshes so
 * the new language takes effect immediately.
 */
export function LanguageSelector() {
  const locale = useLocale();
  const t = useTranslations('common');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const change = (code: string) => {
    if (code === locale) return;
    try {
      document.cookie = `piroka_locale=${code}; path=/; max-age=31536000; samesite=lax`;
    } catch {}
    // Mirror to the profile so the choice follows the member across devices. Best-effort.
    fetch('/api/me/language', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: code }),
    }).catch(() => {});
    startTransition(() => router.refresh());
  };

  return (
    <div className="glass flex flex-col gap-2 rounded-card px-4 py-3.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">{t('language')}</p>
      <div className="flex gap-2">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            type="button"
            onClick={() => change(lang.code)}
            disabled={pending}
            aria-pressed={locale === lang.code}
            className={`h-10 flex-1 rounded-input border text-[13px] font-semibold transition-colors disabled:opacity-50 ${
              locale === lang.code
                ? 'border-sel-border bg-sel-fill text-green'
                : 'border-line-2 text-fg-2 hover:text-fg'
            }`}
          >
            {lang.label}
          </button>
        ))}
      </div>
    </div>
  );
}
