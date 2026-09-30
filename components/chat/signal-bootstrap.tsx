'use client';

import { useEffect } from 'react';
import { toB64 } from '@/lib/encryption/primitives';
import {
  generateOneTimePreKeys,
  getCurrentSignedPreKey,
  getMeta,
  getOrCreateIdentity,
  setMeta,
} from '@/lib/encryption/signal-store';

const MIN_ONE_TIME_KEYS = 10;
const BATCH = 25;

/** Ensures this device has an identity and the server holds a fresh pre-key bundle for it. */
async function ensureKeysPublished() {
  if (typeof indexedDB === 'undefined') return;
  const r = await fetch('/api/keys/status', { cache: 'no-store' });
  if (!r.ok) return;
  const status = (await r.json()) as {
    configured: boolean;
    published: boolean;
    identityKey: string | null;
    signedPreKeyId: number | null;
    oneTimeCount: number;
  };
  if (!status.configured) return;

  const identity = await getOrCreateIdentity();
  const myIk = toB64(identity.ik.publicKey);
  const spk = await getCurrentSignedPreKey(identity);

  const identityChanged = status.identityKey !== myIk;
  const spkChanged = status.signedPreKeyId !== spk.id;
  const lowOnKeys = status.oneTimeCount < MIN_ONE_TIME_KEYS;
  const lastPublish = (await getMeta<number>('published:at')) ?? 0;
  if (status.published && !identityChanged && !spkChanged && !lowOnKeys && Date.now() - lastPublish < 6 * 3600_000) return;

  const opks = lowOnKeys || identityChanged ? await generateOneTimePreKeys(BATCH) : [];
  const res = await fetch('/api/keys/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identityKey: myIk,
      signingKey: toB64(identity.sik.publicKey),
      signedPreKey: { id: spk.id, publicKey: toB64(spk.pair.publicKey), signature: toB64(spk.signature) },
      oneTimePreKeys: opks.map((k) => ({ id: k.id, publicKey: toB64(k.pair.publicKey) })),
    }),
  });
  if (res.ok) await setMeta('published:at', Date.now());
}

export function SignalBootstrap() {
  useEffect(() => {
    ensureKeysPublished().catch((e) => console.warn('Signal key publish skipped:', e));
  }, []);
  return null;
}
