import type { Session } from './types';

/**
 * Demo-mode session cookie: base64url(JSON) + "." + HMAC-SHA256. Edge-compatible (Web Crypto only).
 * Not a substitute for Supabase Auth — it exists so the product can be walked end to end without keys.
 */
export const DEMO_COOKIE = 'piroka_demo_session';

const enc = new TextEncoder();
const b64u = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const unb64u = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function key() {
  const secret =
    process.env.NEXTAUTH_SECRET || process.env.DEMO_AUTH_SECRET || 'piroka-demo-secret-change-me';
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

export async function signSession(s: Session): Promise<string> {
  const payload = b64u(enc.encode(JSON.stringify(s)));
  const sig = await crypto.subtle.sign('HMAC', await key(), enc.encode(payload));
  return `${payload}.${b64u(sig)}`;
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await key(), unb64u(sig), enc.encode(payload));
    if (!ok) return null;
    const s = JSON.parse(new TextDecoder().decode(unb64u(payload))) as Session;
    return typeof s.userId === 'string' ? s : null;
  } catch {
    return null;
  }
}

export const demoCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
};
