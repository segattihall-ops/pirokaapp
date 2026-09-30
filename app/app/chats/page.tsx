import type { Metadata } from 'next';
import { ConversationList } from '@/components/chat/conversation-list';

export const metadata: Metadata = { title: 'Chats' };

export default function ChatsPage() {
  return (
    <section className="mx-auto flex w-full max-w-[560px] animate-in flex-col gap-4 px-4 py-6 sm:px-6 sm:py-10">
      <span className="eyebrow">Chats</span>
      <h1 className="text-h2 sm:text-h1">Inbox</h1>
      <ConversationList />
    </section>
  );
}
