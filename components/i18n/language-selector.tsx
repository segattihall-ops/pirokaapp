'use client';

import { useState } from 'react';

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'pt-BR', name: 'Português (Brasil)', flag: '🇧🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
];

interface LanguageSelectorProps {
  current?: string;
  onSelect?: (langCode: string) => void;
}

/**
 * Language selector for i18n
 * Supports: English, Portuguese (Brasil), Spanish
 * Uses next-intl for translations
 */
export function LanguageSelector({ current = 'en', onSelect }: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const currentLang = LANGUAGES.find(l => l.code === current) || LANGUAGES[0];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-line-2 bg-white/5 text-white text-[12px] font-semibold hover:bg-white/10 transition-colors"
      >
        <span>{currentLang.flag}</span>
        <span>{currentLang.name}</span>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 bg-ink-900 border border-line-1 rounded-lg shadow-lg z-50">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => {
                onSelect?.(lang.code);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-3 text-left text-[12px] font-semibold transition-colors flex items-center gap-2 ${
                current === lang.code
                  ? 'bg-green text-ink-950'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              <span>{lang.flag}</span>
              <span>{lang.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
