'use client';

import { browserSupportsWebAuthn, startAuthentication, startRegistration } from '@simplewebauthn/browser';

export const passkeysSupported = () => typeof window !== 'undefined' && browserSupportsWebAuthn();

/** Face ID / Touch ID label that matches the device, for button copy. */
export function biometricLabel(): string {
  if (typeof navigator === 'undefined') return 'Face ID';
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return 'Face ID';
  if (/Macintosh/.test(ua)) return 'Touch ID';
  if (/Android/.test(ua)) return 'fingerprint';
  return 'passkey';
}

async function json(r: Response) {
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? 'Something went wrong');
  return j;
}

/** Friendly message for the browser's own errors (user cancelled, etc.). */
function friendly(e: unknown): Error {
  const name = e instanceof Error ? e.name : '';
  if (name === 'NotAllowedError' || name === 'AbortError') return new Error('Cancelled.');
  if (name === 'InvalidStateError') return new Error('This device is already set up.');
  return e instanceof Error ? e : new Error('Something went wrong');
}

export async function registerPasskey(label?: string): Promise<void> {
  const { options, challengeId } = await json(await fetch('/api/auth/passkey/register', { cache: 'no-store' }));
  let response;
  try {
    response = await startRegistration({ optionsJSON: options });
  } catch (e) {
    throw friendly(e);
  }
  await json(
    await fetch('/api/auth/passkey/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId, response, label }),
    }),
  );
}

export async function signInWithPasskey(): Promise<void> {
  const { options, challengeId } = await json(await fetch('/api/auth/passkey/login', { cache: 'no-store' }));
  let response;
  try {
    response = await startAuthentication({ optionsJSON: options });
  } catch (e) {
    throw friendly(e);
  }
  await json(
    await fetch('/api/auth/passkey/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId, response }),
    }),
  );
}
