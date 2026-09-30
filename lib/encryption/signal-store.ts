/**
 * Client-side key store (IndexedDB). Private keys never leave this device.
 * Stores: identity, spk (signed pre-keys), opk (one-time pre-keys), sessions, plaintext (local message cache).
 */

import { fromB64, toB64, type KeyPair } from './primitives';
import { deserializeRatchet, serializeRatchet, type RatchetState, type SerializedRatchet } from './signal-protocol';
import { createIdentity, createOneTimePreKeys, createSignedPreKey, type Identity, type InitHeader, type OneTimePreKey, type SignedPreKey } from './x3dh';

const DB_NAME = 'piroka-signal';
const DB_VERSION = 2;
const STORES = ['identity', 'spk', 'opk', 'sessions', 'plaintext', 'meta'] as const;
type StoreName = (typeof STORES)[number];

export type SessionRecord = {
  conversationId: string;
  peerUserId: string;
  peerIdentityKey: string;
  role: 'initiator' | 'responder';
  /** True once we have decrypted a message from the peer (or responded to their init). */
  established: boolean;
  /** Initiator keeps sending this until the peer replies. */
  pendingInit: InitHeader | null;
  ad: string;
  ratchet: SerializedRatchet;
  updatedAt: number;
};

export type Session = Omit<SessionRecord, 'ratchet' | 'ad'> & { ratchet: RatchetState; ad: Uint8Array };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
      }
    };
  });
}

async function get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).get(key);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result as T | undefined);
  });
}

async function put(store: StoreName, key: IDBValidKey, value: unknown): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function del(store: StoreName, key: IDBValidKey): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function count(store: StoreName): Promise<number> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).count();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

const kp = {
  ser: (p: KeyPair) => ({ publicKey: toB64(p.publicKey), secretKey: toB64(p.secretKey) }),
  de: (p: { publicKey: string; secretKey: string }): KeyPair => ({
    publicKey: fromB64(p.publicKey),
    secretKey: fromB64(p.secretKey),
  }),
};

/* ---------- identity ---------- */

type StoredIdentity = { ik: ReturnType<typeof kp.ser>; sik: ReturnType<typeof kp.ser> };

export async function getOrCreateIdentity(): Promise<Identity> {
  const stored = await get<StoredIdentity>('identity', 'me');
  if (stored) return { ik: kp.de(stored.ik), sik: kp.de(stored.sik) };
  const id = createIdentity();
  await put('identity', 'me', { ik: kp.ser(id.ik), sik: kp.ser(id.sik) } satisfies StoredIdentity);
  return id;
}

/* ---------- signed pre-key ---------- */

type StoredSPK = { id: number; pair: ReturnType<typeof kp.ser>; signature: string; createdAt: number };
const SPK_ROTATE_MS = 7 * 24 * 60 * 60 * 1000;

export async function getCurrentSignedPreKey(identity: Identity): Promise<SignedPreKey> {
  const currentId = await get<number>('meta', 'spk:current');
  const stored = currentId !== undefined ? await get<StoredSPK>('spk', currentId) : undefined;
  if (stored && Date.now() - stored.createdAt < SPK_ROTATE_MS) {
    return { id: stored.id, pair: kp.de(stored.pair), signature: fromB64(stored.signature), createdAt: stored.createdAt };
  }
  const nextId = ((await get<number>('meta', 'spk:next')) ?? 1) as number;
  const spk = createSignedPreKey(identity, nextId);
  await put('spk', spk.id, {
    id: spk.id,
    pair: kp.ser(spk.pair),
    signature: toB64(spk.signature),
    createdAt: spk.createdAt,
  } satisfies StoredSPK);
  await put('meta', 'spk:current', spk.id);
  await put('meta', 'spk:next', nextId + 1);
  return spk;
}

export async function getSignedPreKey(id: number): Promise<SignedPreKey | null> {
  const s = await get<StoredSPK>('spk', id);
  return s ? { id: s.id, pair: kp.de(s.pair), signature: fromB64(s.signature), createdAt: s.createdAt } : null;
}

/* ---------- one-time pre-keys ---------- */

type StoredOPK = { id: number; pair: ReturnType<typeof kp.ser> };

export async function generateOneTimePreKeys(n: number): Promise<OneTimePreKey[]> {
  const start = ((await get<number>('meta', 'opk:next')) ?? 1) as number;
  const keys = createOneTimePreKeys(start, n);
  for (const k of keys) await put('opk', k.id, { id: k.id, pair: kp.ser(k.pair) } satisfies StoredOPK);
  await put('meta', 'opk:next', start + n);
  return keys;
}

export async function takeOneTimePreKey(id: number): Promise<OneTimePreKey | null> {
  const s = await get<StoredOPK>('opk', id);
  if (!s) return null;
  await del('opk', id);
  return { id: s.id, pair: kp.de(s.pair) };
}

export const localOneTimePreKeyCount = () => count('opk');

/* ---------- sessions ---------- */

export async function loadSession(conversationId: string): Promise<Session | null> {
  const r = await get<SessionRecord>('sessions', conversationId);
  if (!r) return null;
  return { ...r, ratchet: deserializeRatchet(r.ratchet), ad: fromB64(r.ad) };
}

export async function saveSession(s: Session): Promise<void> {
  const rec: SessionRecord = { ...s, ratchet: serializeRatchet(s.ratchet), ad: toB64(s.ad), updatedAt: Date.now() };
  await put('sessions', s.conversationId, rec);
}

export const deleteSession = (conversationId: string) => del('sessions', conversationId);

/* ---------- local plaintext cache (ratchet keys are one-shot; history must be cached) ---------- */

export type CachedMessage = { plaintext: string; at: number };

export const cachePlaintext = (conversationId: string, messageId: string, plaintext: string) =>
  put('plaintext', `${conversationId}:${messageId}`, { plaintext, at: Date.now() } satisfies CachedMessage);

export const getCachedPlaintext = async (conversationId: string, messageId: string) =>
  (await get<CachedMessage>('plaintext', `${conversationId}:${messageId}`))?.plaintext ?? null;

/* ---------- misc ---------- */

export const getMeta = <T>(key: string) => get<T>('meta', key);
export const setMeta = (key: string, value: unknown) => put('meta', key, value);

/** Wipe every key and cached plaintext on this device (sign-out). */
export async function clearSignalStore(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([...STORES], 'readwrite');
    for (const name of STORES) tx.objectStore(name).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
