/**
 * Public contact addresses, legal identity, and canonical site origin.
 *
 * Mail is hosted on pirokaapp.com. Change CONTACT_DOMAIN here; the defaults in
 * .env.example must use the same local parts. These constants are what the app
 * shows and what it falls back to.
 */

export const CONTACT_DOMAIN = 'pirokaapp.com';

/** Confirmed operator / contracting entity for PIROKA. */
export const LEGAL_ENTITY_NAME = 'X RankFlow Media Group LLC';

/** Confirmed legal notice address supplied by the operator. */
export const LEGAL_NOTICE_ADDRESS = '8 The Green, Dover, DE 19904, United States';

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
