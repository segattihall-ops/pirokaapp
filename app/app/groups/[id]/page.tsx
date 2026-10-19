import type { Metadata } from 'next';
import { getSession } from '@/lib/auth/server';
import { GroupDetail } from '@/components/groups/detail';

export const metadata: Metadata = { title: 'Group' };
export const dynamic = 'force-dynamic';

export default async function GroupPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return null;

  return (
    <section className="mx-auto flex w-full max-w-[560px] animate-in flex-col gap-4 px-4 py-6 sm:px-6 sm:py-10">
      <GroupDetail groupId={params.id} meId={session.userId} />
    </section>
  );
}
