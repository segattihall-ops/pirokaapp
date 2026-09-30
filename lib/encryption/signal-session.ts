/**
 * Per-conversation Signal sessions: X3DH to start, Double Ratchet per message.
 * Wire format (`Envelope`) is what gets stored as `messages.ciphertext`.
 */

import { fromUtf8, utf8 } from './primitives';
import { ratchetDecrypt, ratchetEncrypt, ratchetInitAlice, ratchetInitBob, type RatchetMessage } from './signal-protocol';
import {
  getOrCreateIdentity,
  getSignedPreKey,
  loadSession,
  saveSession,
  takeOneTimePreKey,
  type Session,
} from './signal-store';
import { fromB64 } from './primitives';
import { x3dhInitiate, x3dhRespond, type InitHeader, type PreKeyBundle } from './x3dh';

export type Envelope = { v: 1; init?: InitHeader; msg: RatchetMessage };

async function fetchBundle(userId: string): Promise<PreKeyBundle> {
  const r = await fetch(`/api/keys/bundle?userId=${encodeURIComponent(userId)}`, { cache: 'no-store' });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Peer has not set up encryption yet');
  return r.json();
}

async function startAsInitiator(conversationId: string, peerUserId: string): Promise<Session> {
  const me = await getOrCreateIdentity();
  const bundle = await fetchBundle(peerUserId);
  const { SK, AD, init } = x3dhInitiate(me, bundle);
  const session: Session = {
    conversationId,
    peerUserId,
    peerIdentityKey: bundle.identityKey,
    role: 'initiator',
    established: false,
    pendingInit: init,
    ad: AD,
    ratchet: ratchetInitAlice(SK, fromB64(bundle.signedPreKey.publicKey)),
    updatedAt: Date.now(),
  };
  await saveSession(session);
  return session;
}

async function startAsResponder(conversationId: string, peerUserId: string, init: InitHeader): Promise<Session> {
  const me = await getOrCreateIdentity();
  const spk = await getSignedPreKey(init.spkId);
  if (!spk) throw new Error('Signed pre-key not found on this device');
  const opk = init.opkId !== undefined ? await takeOneTimePreKey(init.opkId) : null;
  const { SK, AD } = x3dhRespond(me, spk, opk, init);
  return {
    conversationId,
    peerUserId,
    peerIdentityKey: init.ik,
    role: 'responder',
    established: true,
    pendingInit: null,
    ad: AD,
    ratchet: ratchetInitBob(SK, spk.pair),
    updatedAt: Date.now(),
  };
}

export async function encryptForConversation(
  conversationId: string,
  peerUserId: string,
  plaintext: string,
): Promise<Envelope> {
  const session = (await loadSession(conversationId)) ?? (await startAsInitiator(conversationId, peerUserId));
  const { state, message } = ratchetEncrypt(session.ratchet, utf8(plaintext), session.ad);
  await saveSession({ ...session, ratchet: state });
  return { v: 1, ...(session.pendingInit ? { init: session.pendingInit } : {}), msg: message };
}

/**
 * Decrypts a peer message. Simultaneous-start conflicts (both sides initiated before seeing
 * the other) resolve deterministically: the lower user id keeps its initiator session.
 */
export async function decryptFromConversation(
  conversationId: string,
  myUserId: string,
  peerUserId: string,
  envelope: Envelope,
): Promise<string> {
  let session = await loadSession(conversationId);

  if (envelope.init) {
    const needResponder =
      !session ||
      (session.role === 'initiator' && !session.established && peerUserId < myUserId) ||
      (session.role === 'responder' && session.peerIdentityKey !== envelope.init.ik);
    if (needResponder) session = await startAsResponder(conversationId, peerUserId, envelope.init);
  }
  if (!session) throw new Error('No session for this conversation');

  const { state, plaintext } = ratchetDecrypt(session.ratchet, envelope.msg, session.ad);
  await saveSession({ ...session, ratchet: state, established: true, pendingInit: null });
  return fromUtf8(plaintext);
}

export async function peerIdentityKey(conversationId: string): Promise<string | null> {
  return (await loadSession(conversationId))?.peerIdentityKey ?? null;
}
