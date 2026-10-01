export interface Country {
  name: string;
  code: string;
  flag: string;
}

// List of countries with ISO 3166-1 alpha-2 codes and emoji flags
export const COUNTRIES: Country[] = [
  { name: 'United States', code: 'US', flag: '🇺🇸' },
  { name: 'Canada', code: 'CA', flag: '🇨🇦' },
  { name: 'Mexico', code: 'MX', flag: '🇲🇽' },
  { name: 'Brazil', code: 'BR', flag: '🇧🇷' },
  { name: 'United Kingdom', code: 'GB', flag: '🇬🇧' },
  { name: 'France', code: 'FR', flag: '🇫🇷' },
  { name: 'Germany', code: 'DE', flag: '🇩🇪' },
  { name: 'Spain', code: 'ES', flag: '🇪🇸' },
  { name: 'Italy', code: 'IT', flag: '🇮🇹' },
  { name: 'Netherlands', code: 'NL', flag: '🇳🇱' },
  { name: 'Belgium', code: 'BE', flag: '🇧🇪' },
  { name: 'Switzerland', code: 'CH', flag: '🇨🇭' },
  { name: 'Austria', code: 'AT', flag: '🇦🇹' },
  { name: 'Sweden', code: 'SE', flag: '🇸🇪' },
  { name: 'Norway', code: 'NO', flag: '🇳🇴' },
  { name: 'Denmark', code: 'DK', flag: '🇩🇰' },
  { name: 'Poland', code: 'PL', flag: '🇵🇱' },
  { name: 'Japan', code: 'JP', flag: '🇯🇵' },
  { name: 'South Korea', code: 'KR', flag: '🇰🇷' },
  { name: 'China', code: 'CN', flag: '🇨🇳' },
  { name: 'India', code: 'IN', flag: '🇮🇳' },
  { name: 'Australia', code: 'AU', flag: '🇦🇺' },
  { name: 'New Zealand', code: 'NZ', flag: '🇳🇿' },
  { name: 'South Africa', code: 'ZA', flag: '🇿🇦' },
  { name: 'Thailand', code: 'TH', flag: '🇹🇭' },
  { name: 'Vietnam', code: 'VN', flag: '🇻🇳' },
  { name: 'Philippines', code: 'PH', flag: '🇵🇭' },
  { name: 'Indonesia', code: 'ID', flag: '🇮🇩' },
  { name: 'Singapore', code: 'SG', flag: '🇸🇬' },
  { name: 'Malaysia', code: 'MY', flag: '🇲🇾' },
];

export function getCountryFlag(code: string): string | null {
  const country = COUNTRIES.find((c) => c.code === code);
  return country?.flag || null;
}

export function getCountryName(code: string): string | null {
  const country = COUNTRIES.find((c) => c.code === code);
  return country?.name || null;
}
