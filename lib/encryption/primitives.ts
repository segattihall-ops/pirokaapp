import nacl from 'tweetnacl';
import { sha256 } from '@noble/hashes/sha2.js';
import { hmac } from '@noble/hashes/hmac.js';
import { extract, expand } from '@noble/hashes/hkdf.js';
import { chacha20poly1305 } from '@noble/ciphers/chacha.js';

export type KeyPair = { publicKey: Uint8Array; secretKey: Uint8Array };

export const randomBytes = (n: number) => nacl.randomBytes(n);

/** X25519 key pair (Signal's Curve25519 DH). */
export const generateDHKeyPair = (): KeyPair => nacl.box.keyPair();

/** Ed25519 key pair, used to sign the signed pre-key. */
export const generateSigningKeyPair = (): KeyPair => nacl.sign.keyPair();

export function dh(secretKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
  const out = nacl.scalarMult(secretKey, publicKey);
  if (out.every((b) => b === 0)) throw new Error('Invalid DH public key');
  return out;
}

export const sign = (message: Uint8Array, secretKey: Uint8Array) => nacl.sign.detached(message, secretKey);
export const verify = (message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array) =>
  nacl.sign.detached.verify(message, signature, publicKey);

export function hkdf(ikm: Uint8Array, salt: Uint8Array, info: string, length: number): Uint8Array {
  const prk = extract(sha256, ikm, salt);
  return expand(sha256, prk, utf8(info), length);
}

export const hmacSha256 = (key: Uint8Array, message: Uint8Array) => hmac(sha256, key, message);

export function aeadEncrypt(key: Uint8Array, nonce: Uint8Array, aad: Uint8Array, plaintext: Uint8Array) {
  return chacha20poly1305(key, nonce, aad).encrypt(plaintext);
}

export function aeadDecrypt(key: Uint8Array, nonce: Uint8Array, aad: Uint8Array, ciphertext: Uint8Array) {
  return chacha20poly1305(key, nonce, aad).decrypt(ciphertext);
}

export function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export const equal = (a: Uint8Array, b: Uint8Array) => a.length === b.length && nacl.verify(a, b);

export const utf8 = (s: string) => new TextEncoder().encode(s);
export const fromUtf8 = (b: Uint8Array) => new TextDecoder().decode(b);

export function u32be(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n >>> 0);
  return b;
}

export function toB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  }
  return typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64');
}

export function fromB64(s: string): Uint8Array {
  const bin = typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('binary');
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
