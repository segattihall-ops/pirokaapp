/**
 * Message encryption/decryption
 * Server stores only ciphertext; plaintext never leaves client
 *
 * Uses Web Crypto API (AES-256-GCM)
 * Production: libsignal DoubleRatchet for forward secrecy
 */

import { deriveConversationKey, retrieveKeyMaterial } from './keys';

const ALGORITHM = {
  name: 'AES-GCM',
  length: 256
};

const IV_LENGTH = 12; // 96 bits for GCM

/**
 * Encrypt a message (client-side before upload)
 * Returns ciphertext as base64
 */
export async function encryptMessage(
  plaintext: string,
  conversationId: string
): Promise<{
  ciphertext: string;
  iv: string;
} | null> {
  try {
    // Get or derive conversation key
    let keyMaterial = await retrieveKeyMaterial(conversationId);
    if (!keyMaterial) {
      keyMaterial = await deriveConversationKey(conversationId, '');
    }

    // Import key for Web Crypto
    const key = await crypto.subtle.importKey(
      'raw',
      keyMaterial.keyMaterial,
      ALGORITHM,
      false,
      ['encrypt']
    );

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    // Encrypt
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    const ciphertext = await crypto.subtle.encrypt(
      { ...ALGORITHM, iv },
      key,
      data
    );

    // Return base64 encoded
    return {
      ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
      iv: btoa(String.fromCharCode(...iv))
    };
  } catch (error) {
    console.error('Encryption failed:', error);
    return null;
  }
}

/**
 * Decrypt a message (after download from server)
 * Returns plaintext or null on error
 */
export async function decryptMessage(
  ciphertextBase64: string,
  ivBase64: string,
  conversationId: string
): Promise<string | null> {
  try {
    // Get stored conversation key
    let keyMaterial = await retrieveKeyMaterial(conversationId);
    if (!keyMaterial) {
      // Try to re-derive (may fail if session lost)
      keyMaterial = await deriveConversationKey(conversationId, '');
    }

    // Import key
    const key = await crypto.subtle.importKey(
      'raw',
      keyMaterial.keyMaterial,
      ALGORITHM,
      false,
      ['decrypt']
    );

    // Decode from base64
    const ciphertext = new Uint8Array(
      atob(ciphertextBase64)
        .split('')
        .map((c) => c.charCodeAt(0))
    );

    const iv = new Uint8Array(
      atob(ivBase64)
        .split('')
        .map((c) => c.charCodeAt(0))
    );

    // Decrypt
    const plaintext = await crypto.subtle.decrypt(
      { ...ALGORITHM, iv },
      key,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(plaintext);
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
}

/**
 * Bulk decrypt messages (for loading conversation history)
 * Returns array with null for failed decryptions
 */
export async function decryptMessages(
  messages: Array<{ ciphertext: string; iv: string; id: string }>,
  conversationId: string
): Promise<Array<{ id: string; plaintext: string | null }>> {
  const results = await Promise.all(
    messages.map(async (msg) => ({
      id: msg.id,
      plaintext: await decryptMessage(msg.ciphertext, msg.iv, conversationId)
    }))
  );

  return results;
}

/**
 * Test encryption round-trip
 */
export async function testEncryption(): Promise<boolean> {
  const testMsg = 'Hello, encrypted world!';
  const convId = 'test-conv-' + Date.now();

  const encrypted = await encryptMessage(testMsg, convId);
  if (!encrypted) return false;

  const decrypted = await decryptMessage(encrypted.ciphertext, encrypted.iv, convId);
  return decrypted === testMsg;
}
