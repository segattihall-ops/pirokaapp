/**
 * ECDH (Elliptic Curve Diffie-Hellman) using Curve25519
 *
 * Curve25519 is used by Signal Protocol for key agreement.
 * In production, use @libsodium/libsodium.js for native implementation.
 *
 * This is a placeholder using Web Crypto P-256 as an interim solution.
 * TODO: Migrate to native libsodium Curve25519 once available.
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { extract, expand } from '@noble/hashes/hkdf.js';

/**
 * Generate an ECDH key pair (Curve25519)
 */
export async function generateECDHKeyPair(): Promise<{
  publicKey: Uint8Array;
  privateKey: CryptoKey;
}> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256' // TODO: Switch to Curve25519 when available
    },
    true, // extractable
    ['deriveKey', 'deriveBits']
  );

  if (!keyPair.publicKey) {
    throw new Error('Failed to generate key pair');
  }

  const publicKeyData = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const publicKey = new Uint8Array(publicKeyData);

  return {
    publicKey,
    privateKey: keyPair.privateKey
  };
}

/**
 * Derive shared secret via ECDH
 */
export async function deriveSharedSecret(
  privateKey: CryptoKey,
  otherPublicKey: Uint8Array
): Promise<Uint8Array> {
  // Import the other party's public key
  const importedPublicKey = await crypto.subtle.importKey(
    'raw',
    otherPublicKey as BufferSource,
    {
      name: 'ECDH',
      namedCurve: 'P-256'
    },
    false,
    []
  );

  // Perform ECDH and derive 32 bytes (256 bits)
  const sharedSecret = await crypto.subtle.deriveBits(
    {
      name: 'ECDH',
      public: importedPublicKey
    },
    privateKey,
    256
  );

  return new Uint8Array(sharedSecret);
}

/**
 * Pre-key bundle for Signal Protocol initialization
 * (One-time use keys for forward secrecy on first message)
 */
export type PreKeyBundle = {
  identityKey: Uint8Array; // Long-term identity key
  signedPreKey: Uint8Array; // Signed ephemeral key
  oneTimePreKey: Uint8Array; // One-time use key
  oneTimePreKeyId: number;
  signature: Uint8Array; // Signature over pre-keys
};

/**
 * Generate pre-key bundle
 */
export async function generatePreKeyBundle(
  identityPrivateKey: CryptoKey,
  preKeyId: number
): Promise<PreKeyBundle> {
  const { publicKey: signedPreKey } = await generateECDHKeyPair();
  const { publicKey: oneTimePreKey } = await generateECDHKeyPair();

  // In production: sign with identity key using Ed25519
  // For now: placeholder signature
  const signature = crypto.getRandomValues(new Uint8Array(64));

  // Export identity key
  const identityKey = await crypto.subtle.exportKey('raw', identityPrivateKey);

  return {
    identityKey: new Uint8Array(identityKey),
    signedPreKey,
    oneTimePreKey,
    oneTimePreKeyId: preKeyId,
    signature
  };
}

/**
 * ECDH handshake (Triple DH)
 * Combines three ECDH operations for stronger key derivation
 */
export async function tripleDH(
  initiatorPrivateKey: CryptoKey,
  initiatorPublicKey: Uint8Array,
  responderPublicKey: Uint8Array,
  responderPreKey: Uint8Array,
  responderOneTimePreKey: Uint8Array
): Promise<Uint8Array> {
  // Three ECDH operations for forward secrecy
  const dh1 = await deriveSharedSecret(initiatorPrivateKey, responderPublicKey);
  const dh2 = await deriveSharedSecret(initiatorPrivateKey, responderPreKey);
  const dh3 = await deriveSharedSecret(initiatorPrivateKey, responderOneTimePreKey);

  // Combine using HKDF
  const combined = new Uint8Array(dh1.length + dh2.length + dh3.length);
  combined.set(dh1, 0);
  combined.set(dh2, dh1.length);
  combined.set(dh3, dh1.length + dh2.length);

  // KDF the combined secret
  const prk = extract(sha256, combined, new Uint8Array(0));
  const info = new TextEncoder().encode('Signal Protocol');
  const dkm = expand(sha256, prk, info, 32);

  return dkm;
}
