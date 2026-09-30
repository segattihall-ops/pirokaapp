/**
 * Double Ratchet (Signal spec: https://signal.org/docs/specifications/doubleratchet/)
 *
 * - DH ratchet on X25519, symmetric-key ratchet on HMAC-SHA256
 * - Message keys derive a fresh ChaCha20-Poly1305 key + nonce; header is authenticated as AAD
 * - Out-of-order delivery via skipped message keys (bounded)
 *
 * State is treated as immutable: every operation returns a new state and the caller
 * persists it only after success, so a failed decrypt never corrupts the session.
 */

import {
  aeadDecrypt,
  aeadEncrypt,
  concat,
  dh,
  equal,
  fromB64,
  generateDHKeyPair,
  hkdf,
  hmacSha256,
  toB64,
  u32be,
  type KeyPair,
} from './primitives';

export type RatchetState = {
  DHs: KeyPair;
  DHr: Uint8Array | null;
  RK: Uint8Array;
  CKs: Uint8Array | null;
  CKr: Uint8Array | null;
  Ns: number;
  Nr: number;
  PN: number;
  /** `${b64(dhPub)}:${n}` -> message key */
  skipped: Map<string, Uint8Array>;
};

export type MessageHeader = { dh: string; pn: number; n: number };
export type RatchetMessage = { header: MessageHeader; ciphertext: string };

const MAX_SKIP = 1000;
const MAX_SKIPPED_STORED = 2000;

function kdfRoot(rk: Uint8Array, dhOut: Uint8Array): { rk: Uint8Array; ck: Uint8Array } {
  const out = hkdf(dhOut, rk, 'piroka/ratchet/root', 64);
  return { rk: out.slice(0, 32), ck: out.slice(32, 64) };
}

function kdfChain(ck: Uint8Array): { ck: Uint8Array; mk: Uint8Array } {
  return { mk: hmacSha256(ck, new Uint8Array([0x01])), ck: hmacSha256(ck, new Uint8Array([0x02])) };
}

function headerBytes(h: MessageHeader): Uint8Array {
  return concat(fromB64(h.dh), u32be(h.pn), u32be(h.n));
}

function messageKeyMaterial(mk: Uint8Array): { key: Uint8Array; nonce: Uint8Array } {
  const out = hkdf(mk, new Uint8Array(32), 'piroka/ratchet/msg', 44);
  return { key: out.slice(0, 32), nonce: out.slice(32, 44) };
}

function clone(s: RatchetState): RatchetState {
  return { ...s, skipped: new Map(s.skipped) };
}

/** Initiator: has the responder's ratchet public key (their signed pre-key) from the X3DH bundle. */
export function ratchetInitAlice(SK: Uint8Array, bobPublicKey: Uint8Array): RatchetState {
  const DHs = generateDHKeyPair();
  const { rk, ck } = kdfRoot(SK, dh(DHs.secretKey, bobPublicKey));
  return { DHs, DHr: bobPublicKey, RK: rk, CKs: ck, CKr: null, Ns: 0, Nr: 0, PN: 0, skipped: new Map() };
}

/** Responder: uses the pre-key pair the initiator addressed. */
export function ratchetInitBob(SK: Uint8Array, bobKeyPair: KeyPair): RatchetState {
  return { DHs: bobKeyPair, DHr: null, RK: SK, CKs: null, CKr: null, Ns: 0, Nr: 0, PN: 0, skipped: new Map() };
}

export function ratchetEncrypt(
  state: RatchetState,
  plaintext: Uint8Array,
  ad: Uint8Array,
): { state: RatchetState; message: RatchetMessage } {
  const s = clone(state);
  if (!s.CKs) throw new Error('Sending chain not initialised');
  const { ck, mk } = kdfChain(s.CKs);
  s.CKs = ck;
  const header: MessageHeader = { dh: toB64(s.DHs.publicKey), pn: s.PN, n: s.Ns };
  s.Ns += 1;
  const { key, nonce } = messageKeyMaterial(mk);
  const ciphertext = aeadEncrypt(key, nonce, concat(ad, headerBytes(header)), plaintext);
  return { state: s, message: { header, ciphertext: toB64(ciphertext) } };
}

export function ratchetDecrypt(
  state: RatchetState,
  message: RatchetMessage,
  ad: Uint8Array,
): { state: RatchetState; plaintext: Uint8Array } {
  const s = clone(state);
  const { header } = message;
  const aad = concat(ad, headerBytes(header));
  const ciphertext = fromB64(message.ciphertext);

  const skippedKey = `${header.dh}:${header.n}`;
  const mkSkipped = s.skipped.get(skippedKey);
  if (mkSkipped) {
    s.skipped.delete(skippedKey);
    const { key, nonce } = messageKeyMaterial(mkSkipped);
    return { state: s, plaintext: aeadDecrypt(key, nonce, aad, ciphertext) };
  }

  const senderDH = fromB64(header.dh);
  if (!s.DHr || !equal(senderDH, s.DHr)) {
    skipMessageKeys(s, header.pn);
    dhRatchet(s, senderDH);
  }
  skipMessageKeys(s, header.n);

  if (!s.CKr) throw new Error('Receiving chain not initialised');
  const { ck, mk } = kdfChain(s.CKr);
  s.CKr = ck;
  s.Nr += 1;
  const { key, nonce } = messageKeyMaterial(mk);
  const plaintext = aeadDecrypt(key, nonce, aad, ciphertext);
  return { state: s, plaintext };
}

function skipMessageKeys(s: RatchetState, until: number) {
  if (s.Nr + MAX_SKIP < until) throw new Error('Too many skipped messages');
  if (!s.CKr) return;
  while (s.Nr < until) {
    const { ck, mk } = kdfChain(s.CKr);
    s.CKr = ck;
    s.skipped.set(`${toB64(s.DHr!)}:${s.Nr}`, mk);
    s.Nr += 1;
  }
  while (s.skipped.size > MAX_SKIPPED_STORED) {
    const oldest = s.skipped.keys().next().value;
    if (oldest === undefined) break;
    s.skipped.delete(oldest);
  }
}

function dhRatchet(s: RatchetState, senderDH: Uint8Array) {
  s.PN = s.Ns;
  s.Ns = 0;
  s.Nr = 0;
  s.DHr = senderDH;
  let step = kdfRoot(s.RK, dh(s.DHs.secretKey, s.DHr));
  s.RK = step.rk;
  s.CKr = step.ck;
  s.DHs = generateDHKeyPair();
  step = kdfRoot(s.RK, dh(s.DHs.secretKey, s.DHr));
  s.RK = step.rk;
  s.CKs = step.ck;
}

/* ---------- serialization (IndexedDB / JSON) ---------- */

export type SerializedRatchet = {
  DHs: { publicKey: string; secretKey: string };
  DHr: string | null;
  RK: string;
  CKs: string | null;
  CKr: string | null;
  Ns: number;
  Nr: number;
  PN: number;
  skipped: [string, string][];
};

export function serializeRatchet(s: RatchetState): SerializedRatchet {
  return {
    DHs: { publicKey: toB64(s.DHs.publicKey), secretKey: toB64(s.DHs.secretKey) },
    DHr: s.DHr ? toB64(s.DHr) : null,
    RK: toB64(s.RK),
    CKs: s.CKs ? toB64(s.CKs) : null,
    CKr: s.CKr ? toB64(s.CKr) : null,
    Ns: s.Ns,
    Nr: s.Nr,
    PN: s.PN,
    skipped: Array.from(s.skipped.entries()).map(([k, v]) => [k, toB64(v)]),
  };
}

export function deserializeRatchet(j: SerializedRatchet): RatchetState {
  return {
    DHs: { publicKey: fromB64(j.DHs.publicKey), secretKey: fromB64(j.DHs.secretKey) },
    DHr: j.DHr ? fromB64(j.DHr) : null,
    RK: fromB64(j.RK),
    CKs: j.CKs ? fromB64(j.CKs) : null,
    CKr: j.CKr ? fromB64(j.CKr) : null,
    Ns: j.Ns,
    Nr: j.Nr,
    PN: j.PN,
    skipped: new Map(j.skipped.map(([k, v]) => [k, fromB64(v)])),
  };
}

/** Round-trip self test including out-of-order delivery and a DH ratchet step. */
export function testDoubleRatchet(): boolean {
  const SK = hkdf(new Uint8Array(32).fill(7), new Uint8Array(32), 'test', 32);
  const bob = generateDHKeyPair();
  const ad = new Uint8Array([1, 2, 3]);
  let a = ratchetInitAlice(SK, bob.publicKey);
  let b = ratchetInitBob(SK, bob);
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const m1 = ratchetEncrypt(a, enc.encode('one'), ad);
  a = m1.state;
  const m2 = ratchetEncrypt(a, enc.encode('two'), ad);
  a = m2.state;
  const r2 = ratchetDecrypt(b, m2.message, ad);
  b = r2.state;
  const r1 = ratchetDecrypt(b, m1.message, ad);
  b = r1.state;
  if (dec.decode(r1.plaintext) !== 'one' || dec.decode(r2.plaintext) !== 'two') return false;

  const m3 = ratchetEncrypt(b, enc.encode('three'), ad);
  b = m3.state;
  const r3 = ratchetDecrypt(a, m3.message, ad);
  a = r3.state;
  if (dec.decode(r3.plaintext) !== 'three') return false;

  const m4 = ratchetEncrypt(a, enc.encode('four'), ad);
  const r4 = ratchetDecrypt(b, m4.message, ad);
  return dec.decode(r4.plaintext) === 'four';
}
