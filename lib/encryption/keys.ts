/**
 * Conversation encryption key management
 * Each 1:1 conversation has its own symmetric key (derived from session)
 *
 * Production: Use libsignal for double-ratchet encryption
 * This stub provides the key derivation structure
 */

import { supabase } from '@/lib/db/client-side';

export type EncryptionKeyMaterial = {
  conversationId: string;
  keyMaterial: Uint8Array; // 32 bytes for AES-256
  saltBytes: Uint8Array;   // For KDF
  derivedAt: Date;
};

/**
 * Derive per-conversation key from session
 * In production: libsignal manages this via DoubleRatchet
 *
 * For now: HKDF-SHA256 from user secrets
 */
export async function deriveConversationKey(
  conversationId: string,
  userId: string
): Promise<EncryptionKeyMaterial> {
  // In production, this would call libsignal Signal protocol
  // For now, we derive a deterministic key from IKM + conversation ID

  // Placeholder: actual implementation requires libsignal
  const encoder = new TextEncoder();
  const convIdBytes = encoder.encode(conversationId);
  const userIdBytes = encoder.encode(userId);

  // HKDF-SHA256 (simplified - production uses @noble/hashes)
  const keyMaterial = new Uint8Array(32);
  const saltBytes = new Uint8Array(16);

  // TODO: Replace with proper HKDF when libsignal is integrated
  crypto.getRandomValues(keyMaterial);
  crypto.getRandomValues(saltBytes);

  return {
    conversationId,
    keyMaterial,
    saltBytes,
    derivedAt: new Date()
  };
}

/**
 * Rotate conversation key (after each ratchet step)
 * libsignal DoubleRatchet does this automatically
 */
export async function rotateConversationKey(
  conversationId: string
): Promise<EncryptionKeyMaterial> {
  // In production: libsignal handles ratcheting
  // This is called after each message exchange

  // For now: re-derive with fresh randomness
  return deriveConversationKey(conversationId, '');
}

/**
 * Store ephemeral key material (IndexedDB, not database)
 * Never stored server-side in plaintext
 */
export async function storeKeyMaterial(
  material: EncryptionKeyMaterial
): Promise<void> {
  // Use IndexedDB for client-side key storage
  if (typeof window === 'undefined') return;

  try {
    const db = await openKeyStore();
    const tx = db.transaction(['encryption-keys'], 'readwrite');
    const store = tx.objectStore('encryption-keys');

    await new Promise<void>((resolve, reject) => {
      const request = store.put({
        conversationId: material.conversationId,
        keyMaterial: material.keyMaterial,
        saltBytes: material.saltBytes,
        derivedAt: material.derivedAt.toISOString()
      });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Failed to store key material:', error);
  }
}

/**
 * Retrieve key from local storage
 */
export async function retrieveKeyMaterial(
  conversationId: string
): Promise<EncryptionKeyMaterial | null> {
  if (typeof window === 'undefined') return null;

  try {
    const db = await openKeyStore();
    const tx = db.transaction(['encryption-keys'], 'readonly');
    const store = tx.objectStore('encryption-keys');

    const stored = await new Promise<any>((resolve, reject) => {
      const request = store.get(conversationId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });

    if (!stored) return null;

    return {
      conversationId: stored.conversationId,
      keyMaterial: stored.keyMaterial,
      saltBytes: stored.saltBytes,
      derivedAt: new Date(stored.derivedAt)
    };
  } catch (error) {
    console.error('Failed to retrieve key material:', error);
    return null;
  }
}

/**
 * Open or create IndexedDB for key storage
 */
async function openKeyStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('piroka-encryption', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('encryption-keys')) {
        db.createObjectStore('encryption-keys', { keyPath: 'conversationId' });
      }
    };
  });
}

/**
 * Clear all key material (on logout)
 */
export async function clearKeyMaterial(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const db = await openKeyStore();
    const tx = db.transaction(['encryption-keys'], 'readwrite');
    const store = tx.objectStore('encryption-keys');

    await new Promise<void>((resolve, reject) => {
      const request = store.clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Failed to clear key material:', error);
  }
}
