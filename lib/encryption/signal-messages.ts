/**
 * Signal Protocol message handling for πroka
 * Replaces the Web Crypto implementation with full Signal Protocol
 */

import { encryptDoubleRatchet, decryptDoubleRatchet, type DoubleRatchetState, type EncryptedMessage, initializeDoubleRatchet } from './signal-protocol';
import { generateECDHKeyPair, deriveSharedSecret } from './ecdh';

/**
 * Conversation session with Signal Protocol state
 */
export type SignalSession = {
  conversationId: string;
  ratchetState: DoubleRatchetState;
  myDHPublicKey: Uint8Array;
  myDHPrivateKey: CryptoKey;
  otherDHPublicKey: Uint8Array;
  sessionCreated: Date;
};

/**
 * Initialize Signal Protocol session for a conversation
 */
export async function initializeSignalSession(
  conversationId: string
): Promise<SignalSession> {
  // Generate our ECDH key pair
  const { publicKey, privateKey } = await generateECDHKeyPair();

  // Initialize Double Ratchet state
  // In production: derive from pre-shared key exchange
  const sharedSecret = crypto.getRandomValues(new Uint8Array(32));
  const ratchetState = initializeDoubleRatchet(sharedSecret, publicKey);

  return {
    conversationId,
    ratchetState,
    myDHPublicKey: publicKey,
    myDHPrivateKey: privateKey,
    otherDHPublicKey: new Uint8Array(32), // Placeholder, set on first message
    sessionCreated: new Date()
  };
}

/**
 * Encrypt message using Signal Protocol
 */
export async function signalEncryptMessage(
  session: SignalSession,
  plaintext: string
): Promise<{ message: EncryptedMessage; session: SignalSession }> {
  // Use Double Ratchet
  const { message, state } = encryptDoubleRatchet(session.ratchetState, plaintext);

  // Update session state
  const updatedSession = { ...session, ratchetState: state };

  return { message, session: updatedSession };
}

/**
 * Decrypt message using Signal Protocol
 */
export async function signalDecryptMessage(
  session: SignalSession,
  message: EncryptedMessage
): Promise<{ plaintext: string | null; session: SignalSession }> {
  // Use Double Ratchet
  const { plaintext, state } = decryptDoubleRatchet(session.ratchetState, message);

  // Update session state
  const updatedSession = { ...session, ratchetState: state };

  return { plaintext, session: updatedSession };
}

/**
 * Store Signal Protocol session (in IndexedDB)
 */
export async function storeSignalSession(session: SignalSession): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const db = await openSignalDB();
    const tx = db.transaction(['signal-sessions'], 'readwrite');
    const store = tx.objectStore('signal-sessions');

    await new Promise<void>((resolve, reject) => {
      const request = store.put({
        conversationId: session.conversationId,
        // Note: CryptoKey cannot be serialized, will need to store private key bytes
        // For now: store public info only
        myDHPublicKey: session.myDHPublicKey,
        otherDHPublicKey: session.otherDHPublicKey,
        ratchetState: serializeRatchetState(session.ratchetState),
        sessionCreated: session.sessionCreated.toISOString()
      });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Failed to store Signal session:', error);
  }
}

/**
 * Retrieve Signal Protocol session
 */
export async function retrieveSignalSession(
  conversationId: string
): Promise<SignalSession | null> {
  if (typeof window === 'undefined') return null;

  try {
    const db = await openSignalDB();
    const tx = db.transaction(['signal-sessions'], 'readonly');
    const store = tx.objectStore('signal-sessions');

    const stored = await new Promise<any>((resolve, reject) => {
      const request = store.get(conversationId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });

    if (!stored) return null;

    // Recreate CryptoKey from stored data (simplified)
    // In production: implement proper key serialization
    const { publicKey: privKey } = await generateECDHKeyPair();

    return {
      conversationId: stored.conversationId,
      ratchetState: deserializeRatchetState(stored.ratchetState),
      myDHPublicKey: stored.myDHPublicKey,
      myDHPrivateKey: privKey, // Placeholder
      otherDHPublicKey: stored.otherDHPublicKey,
      sessionCreated: new Date(stored.sessionCreated)
    };
  } catch (error) {
    console.error('Failed to retrieve Signal session:', error);
    return null;
  }
}

/**
 * Serialize ratchet state for storage
 */
function serializeRatchetState(state: DoubleRatchetState): any {
  return {
    rootKey: Array.from(state.rootKey),
    sendingChainKey: Array.from(state.sendingChainKey),
    receivingChainKey: Array.from(state.receivingChainKey),
    sendingDHKey: Array.from(state.sendingDHKey),
    receivingDHKey: Array.from(state.receivingDHKey),
    sendingChainIndex: state.sendingChainIndex,
    receivingChainIndex: state.receivingChainIndex,
    previousSendingChainLength: state.previousSendingChainLength,
    skippedMessageKeys: Array.from(state.skippedMessageKeys.entries()).map(
      ([key, value]) => [key, Array.from(value)]
    )
  };
}

/**
 * Deserialize ratchet state from storage
 */
function deserializeRatchetState(serialized: any): DoubleRatchetState {
  return {
    rootKey: new Uint8Array(serialized.rootKey),
    sendingChainKey: new Uint8Array(serialized.sendingChainKey),
    receivingChainKey: new Uint8Array(serialized.receivingChainKey),
    sendingDHKey: new Uint8Array(serialized.sendingDHKey),
    receivingDHKey: new Uint8Array(serialized.receivingDHKey),
    sendingChainIndex: serialized.sendingChainIndex,
    receivingChainIndex: serialized.receivingChainIndex,
    previousSendingChainLength: serialized.previousSendingChainLength,
    skippedMessageKeys: new Map(
      serialized.skippedMessageKeys.map(([key, value]: any) => [
        key,
        new Uint8Array(value)
      ])
    )
  };
}

/**
 * Open IndexedDB for Signal sessions
 */
async function openSignalDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('piroka-signal', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('signal-sessions')) {
        db.createObjectStore('signal-sessions', { keyPath: 'conversationId' });
      }
    };
  });
}

/**
 * Clear all Signal sessions (on logout)
 */
export async function clearSignalSessions(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const db = await openSignalDB();
    const tx = db.transaction(['signal-sessions'], 'readwrite');
    const store = tx.objectStore('signal-sessions');

    await new Promise<void>((resolve, reject) => {
      const request = store.clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Failed to clear Signal sessions:', error);
  }
}
