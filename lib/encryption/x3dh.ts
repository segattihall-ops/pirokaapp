/**
 * X3DH (https://signal.org/docs/specifications/x3dh/) on X25519 + Ed25519.
 * Produces the shared secret and associated data that seed the Double Ratchet.
 */

import {
  concat,
  dh,
  fromB64,
  generateDHKeyPair,
  generateSigningKeyPair,
  hkdf,
  sign,
  toB64,
  verify,
  type KeyPair,
} from './primitives';

export type Identity = {
  /** X25519 identity key used for DH. */
  ik: KeyPair;
  /** Ed25519 key that signs the signed pre-key. */
  sik: KeyPair;
};

export type SignedPreKey = { id: number; pair: KeyPair; signature: Uint8Array; createdAt: number };
export type OneTimePreKey = { id: number; pair: KeyPair };

/** What the server publishes for a user (public material only). */
export type PreKeyBundle = {
  userId: string;
  identityKey: string;
  signingKey: string;
  signedPreKey: { id: number; publicKey: string; signature: string };
  oneTimePreKey?: { id: number; publicKey: string } | null;
};

/** Sent alongside the initiator's first messages so the responder can derive the same secret. */
export type InitHeader = { ik: string; ek: string; spkId: number; opkId?: number };

const INFO = 'piroka/x3dh/v1';

export function createIdentity(): Identity {
  return { ik: generateDHKeyPair(), sik: generateSigningKeyPair() };
}

export function createSignedPreKey(identity: Identity, id: number): SignedPreKey {
  const pair = generateDHKeyPair();
  return { id, pair, signature: sign(pair.publicKey, identity.sik.secretKey), createdAt: Date.now() };
}

export function createOneTimePreKeys(startId: number, count: number): OneTimePreKey[] {
  return Array.from({ length: count }, (_, i) => ({ id: startId + i, pair: generateDHKeyPair() }));
}

function deriveSK(parts: Uint8Array[]): Uint8Array {
  return hkdf(concat(new Uint8Array(32).fill(0xff), ...parts), new Uint8Array(32), INFO, 32);
}

export function x3dhInitiate(me: Identity, bundle: PreKeyBundle): { SK: Uint8Array; AD: Uint8Array; init: InitHeader } {
  const IKb = fromB64(bundle.identityKey);
  const SIKb = fromB64(bundle.signingKey);
  const SPKb = fromB64(bundle.signedPreKey.publicKey);
  if (!verify(SPKb, fromB64(bundle.signedPreKey.signature), SIKb)) {
    throw new Error('Signed pre-key signature is invalid');
  }
  const EK = generateDHKeyPair();
  const parts = [dh(me.ik.secretKey, SPKb), dh(EK.secretKey, IKb), dh(EK.secretKey, SPKb)];
  if (bundle.oneTimePreKey) parts.push(dh(EK.secretKey, fromB64(bundle.oneTimePreKey.publicKey)));
  return {
    SK: deriveSK(parts),
    AD: concat(me.ik.publicKey, IKb),
    init: {
      ik: toB64(me.ik.publicKey),
      ek: toB64(EK.publicKey),
      spkId: bundle.signedPreKey.id,
      ...(bundle.oneTimePreKey ? { opkId: bundle.oneTimePreKey.id } : {}),
    },
  };
}

export function x3dhRespond(
  me: Identity,
  spk: SignedPreKey,
  opk: OneTimePreKey | null,
  init: InitHeader,
): { SK: Uint8Array; AD: Uint8Array } {
  const IKa = fromB64(init.ik);
  const EKa = fromB64(init.ek);
  const parts = [dh(spk.pair.secretKey, IKa), dh(me.ik.secretKey, EKa), dh(spk.pair.secretKey, EKa)];
  if (init.opkId !== undefined) {
    if (!opk) throw new Error('One-time pre-key no longer available');
    parts.push(dh(opk.pair.secretKey, EKa));
  }
  return { SK: deriveSK(parts), AD: concat(IKa, me.ik.publicKey) };
}

/** Short human-checkable fingerprint of an identity key (safety number). */
export function fingerprint(identityKey: Uint8Array): string {
  const h = hkdf(identityKey, new Uint8Array(32), 'piroka/fingerprint', 30);
  return Array.from(h)
    .map((b) => (b % 10).toString())
    .join('')
    .replace(/(\d{5})(?=\d)/g, '$1 ');
}
