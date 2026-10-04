import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/server';
import { getConversationForUser, getPeerCard, peerOf } from '@/lib/chat/server';
import { SignalChat } from '@/components/chat/signal-chat';

export const metadata: Metadata = { title: 'Chat' };
export const dynamic = 'force-dynamic';

export default async function ConversationPage({ params }: { params: { conversationId: string } }) {
  const session = await getSession();
  if (!session) redirect('/');
  const conv = await getConversationForUser(params.conversationId, session.userId);
  if (!conv) notFound();
  const peerId = peerOf(conv, session.userId);
  const peer = await getPeerCard(peerId, conv.mutual);
  return (
    <SignalChat
      conversationId={conv.id}
      userId={session.userId}
      peerUserId={peerId}
      peerHandle={peer.handle}
      peerPhoto={peer.photo}
    />
  );
}
