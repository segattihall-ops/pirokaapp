import type { Session } from './types';

/** Admins are listed in ADMIN_EMAILS (comma-separated) and/or ADMIN_USER_IDS. */
export function isAdmin(session: Session | null | undefined): boolean {
  if (!session) return false;
  const emails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const ids = (process.env.ADMIN_USER_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return (session.email ? emails.includes(session.email.toLowerCase()) : false) || ids.includes(session.userId);
}
