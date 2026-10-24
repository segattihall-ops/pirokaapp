import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

/**
 * Locale resolution without route-based i18n: the chosen language rides in a `piroka_locale` cookie
 * (set by the language selector, mirrored to `users.language`), so every route stays at its current
 * path — no `/[locale]` segment. Unknown or missing → English.
 */
export const LOCALES = ['en', 'pt-BR', 'es'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(v: string | undefined | null): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v);
}

export default getRequestConfig(async () => {
  let locale: Locale = DEFAULT_LOCALE;
  try {
    const cookie = cookies().get('piroka_locale')?.value;
    if (isLocale(cookie)) locale = cookie;
  } catch {}
  const messages = (await import(`../messages/${locale}.json`)).default;
  return { locale, messages };
});
