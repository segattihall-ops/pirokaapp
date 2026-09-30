'use client';

import { useState } from 'react';

const COUNTRIES: Record<string, string> = {
  'US': '🇺🇸',
  'BR': '🇧🇷',
  'MX': '🇲🇽',
  'ES': '🇪🇸',
  'PT': '🇵🇹',
  'CA': '🇨🇦',
  'UK': '🇬🇧',
  'AU': '🇦🇺',
  'DE': '🇩🇪',
  'FR': '🇫🇷',
  'JP': '🇯🇵',
  'IN': '🇮🇳',
};

interface OriginSelectorProps {
  selected?: string | null;
  onSelect?: (country: string | null) => void;
}

/**
 * Origin/flag selector
 * Shows on profile card and map arrival pins
 * Helps identify travelers and origins
 * Optional field
 */
export function OriginSelector({ selected, onSelect }: OriginSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3 rounded-hero border border-line-1 bg-ink-900 p-4">
      <h3 className="text-[14px] font-bold text-white">Where are you from?</h3>

      <div className="grid grid-cols-4 gap-2">
        {Object.entries(COUNTRIES).map(([code, flag]) => (
          <button
            key={code}
            onClick={() => onSelect?.(code === selected ? null : code)}
            className={`py-3 rounded-lg text-[20px] transition-colors ${
              selected === code
                ? 'bg-green scale-110'
                : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            {flag}
          </button>
        ))}
      </div>

      {selected && (
        <p className="text-[12px] text-fg-3">
          Your origin flag will appear on your profile and arrival pins
        </p>
      )}
    </div>
  );
}
