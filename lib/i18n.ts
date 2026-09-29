import en from '@/messages/en.json';
import ptBR from '@/messages/pt-BR.json';
import es from '@/messages/es.json';

/** String catalogs from the handoff. next-intl wiring lands in Phase 12; until then `t()` reads them directly. */
export const LOCALES = ['en', 'pt-BR', 'es'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

const CATALOGS: Record<Locale, typeof en> = { en, 'pt-BR': ptBR, es };

export function t(
  path: string,
  locale: Locale = DEFAULT_LOCALE,
  vars: Record<string, string | number> = {},
): string {
  const raw = path
    .split('.')
    .reduce<unknown>(
      (o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined),
      CATALOGS[locale],
    );
  const s = typeof raw === 'string' ? raw : path;
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}
