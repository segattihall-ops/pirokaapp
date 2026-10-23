/**
 * Public contact addresses and the canonical site origin.
 *
 * Mail is hosted on pirokaapp.com (IONOS). Change CONTACT_DOMAIN here; the
 * defaults in .env.example must use the same local parts. These constants are
 * what the app shows and what it falls back to. They do not change a sender
 * already set in the host environment.
 */

export const CONTACT_DOMAIN = 'pirokaapp.com';

/** Canonical public site. The apex host redirects here. */
export const PUBLIC_SITE_URL = 'https://www.pirokaapp.com';

export function mailbox(localPart: string): string {
  return `${localPart}@${CONTACT_DOMAIN}`;
}

export const CONTACT_EMAIL = {
  compliance: mailbox('compliance'),
  privacy: mailbox('privacy'),
  support: mailbox('support'),
  legal: mailbox('legal'),
  dmca: mailbox('dmca'),
  safety: mailbox('safety'),
  noReply: mailbox('no-reply'),
} as const;

/** Used only when EMAIL_FROM is unset. Production sets EMAIL_FROM itself. */
export const DEFAULT_EMAIL_FROM = `"πroka" <${CONTACT_EMAIL.noReply}>`;

/** Used only when VAPID_SUBJECT is unset. */
export const DEFAULT_VAPID_SUBJECT = `mailto:${CONTACT_EMAIL.support}`;
