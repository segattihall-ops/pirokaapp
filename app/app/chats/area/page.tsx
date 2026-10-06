import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/server';
import { AreaBoard } from '@/components/chat/area-board';

export const metadata: Metadata = { title: 'Area Board' };
export const dynamic = 'force-dynamic';

export default async function AreaPage() {
  const session = await getSession();
  if (!session) redirect('/');
  return <AreaBoard userId={session.userId} />;
}
