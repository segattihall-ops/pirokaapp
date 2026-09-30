'use client';

import { createClient } from '@/lib/supabase/client';
import type { Session } from './types';

/**
 * Browser-side auth actions. One API for both modes:
 * - supabase: real Supabase Auth (OAuth PKCE, magic link, anonymous, password).
 * - demo: POST /api/auth/demo, which issues the signed demo cookie.
 * Session facts always come from the server (/api/auth/me) so the gate is never trusted client-side.
 */
export const isDemoClient = () =>
  !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function demo(body: Record<string, unknown>) {
  const r = await fetch('/api/auth/demo', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Demo auth failed');
  return r.json() as Promise<{ session: Session | null }>;
}

export async function fetchSession(): Promise<Session | null> {
  const r = await fetch('/api/auth/me', { cache: 'no-store' });
  if (!r.ok) return null;
  return ((await r.json()) as { session: Session | null }).session;
}

const origin = () => (typeof window === 'undefined' ? '' : window.location.origin);
const callback = (next: string) => `${origin()}/auth/callback?next=${encodeURIComponent(next)}`;

export async function signInWithOAuth(provider: 'google' | 'apple', next = '/'): Promise<void> {
  if (isDemoClient()) {
    await demo({ action: 'signin', provider });
    return;
  }
  const sb = createClient()!;
  const { error } = await sb.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: callback(next),
      ...(provider === 'google' ? { queryParams: { prompt: 'select_account' } } : {}),
    },
  });
  if (error) throw error;
}

export async function signInWithMagicLink(email: string, next = '/'): Promise<void> {
  if (isDemoClient()) {
    await demo({ action: 'magic', email });
    return;
  }
  const sb = createClient()!;
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callback(next), shouldCreateUser: true },
  });
  if (error) throw error;
}

export async function signInAnonymously(): Promise<void> {
  if (isDemoClient()) {
    await demo({ action: 'signin', provider: 'anonymous' });
    return;
  }
  const sb = createClient()!;
  const { error } = await sb.auth.signInAnonymously();
  if (error) {
    // Supabase → Authentication → Sign In / Providers → "Allow anonymous sign-ins" is off.
    if (/anonymous sign-ins are disabled/i.test(error.message)) {
      throw new Error('Anonymous sign-in isn’t available yet — use Google, Apple or your email instead.');
    }
    throw error;
  }
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  if (isDemoClient()) {
    await demo({ action: 'password', email, password });
    return;
  }
  const sb = createClient()!;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function requestPasswordReset(email: string): Promise<void> {
  if (isDemoClient()) return;
  const sb = createClient()!;
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: callback('/account/reset') });
  if (error) throw error;
}

export async function updatePassword(password: string): Promise<void> {
  if (isDemoClient()) return;
  const sb = createClient()!;
  const { error } = await sb.auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  if (isDemoClient()) {
    await demo({ action: 'signout' });
    return;
  }
  await createClient()!.auth.signOut();
  await fetch('/api/auth/signout', { method: 'POST' }).catch(() => {});
}

/** Gate steps — always server-validated. */
export async function recordConsent(): Promise<Session> {
  const r = await fetch('/api/consent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ age18: true, terms: true }),
  });
  if (!r.ok) throw new Error('Could not record consent');
  return ((await r.json()) as { session: Session }).session;
}

export async function submitAgeCheck(method: 'face' | 'id', token: string): Promise<Session> {
  const r = await fetch('/api/age/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ method, token }),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Age check failed');
  return ((await r.json()) as { session: Session }).session;
}
