import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/server';
import { MapLoader } from '@/components/map/map-loader';

export const metadata: Metadata = { title: 'Map' };
export const dynamic = 'force-dynamic';

export default async function MapPage() {
  const session = await getSession();
  if (!session) redirect('/');
  return <MapLoader userId={session.userId} />;
}
