import { createHmac, timingSafeEqual } from 'crypto';
import { appUrl } from '@/lib/app-url';

function secret() {
  // Tokens are HMAC(userId); with a known default anyone could opt any member out of email.
  // In production fall back to the service-role key (always present, never public) rather than a
  // literal, so a missing EMAIL_UNSUBSCRIBE_SECRET degrades to a still-unforgeable token.
  const configured =
    process.env.EMAIL_UNSUBSCRIBE_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    (process.env.NODE_ENV === 'production' ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined);
  if (!configured && process.env.NODE_ENV === 'production') {
    throw new Error('EMAIL_UNSUBSCRIBE_SECRET is required in production.');
  }
  return configured || 'piroka-dev-unsubscribe';
}

/** Stable, unguessable token for one user. Links never expire: an unsubscribe must always work. */
export function unsubscribeToken(userId: string): string {
  const sig = createHmac('sha256', secret()).update(userId).digest('base64url');
  return `${Buffer.from(userId).toString('base64url')}.${sig}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const [idPart, sig] = token.split('.');
  if (!idPart || !sig) return null;
  let userId: string;
  try {
    userId = Buffer.from(idPart, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  const expected = createHmac('sha256', secret()).update(userId).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}

export function unsubscribeUrl(userId: string): string {
  return appUrl(`/unsubscribe?token=${encodeURIComponent(unsubscribeToken(userId))}`);
}
