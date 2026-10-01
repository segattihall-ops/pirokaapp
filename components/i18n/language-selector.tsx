'use client';

import { useLocale } from 'next-intl';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function LanguageSelector() {
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'pt-BR', label: 'Português (Brasil)' },
    { code: 'es', label: 'Español' },
  ];

  const handleLanguageChange = (newLocale: string) => {
    startTransition(() => {
      router.push(`/${newLocale}`);
    });
  };

  return (
    <div className="space-y-2">
      <label className="text-[12px] font-semibold text-fg-2">Language</label>
      <div className="flex gap-2">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            disabled={isPending}
            className={`px-3 py-2 rounded-lg text-[12px] font-medium transition-colors ${
              locale === lang.code
                ? 'bg-green text-ink-950'
                : 'bg-line-2 text-fg-2 hover:bg-line-1'
            } disabled:opacity-50`}
          >
            {lang.label}
          </button>
        ))}
      </div>
    </div>
  );
}
