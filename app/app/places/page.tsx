import type { Metadata } from 'next';
import { PlacesScreen } from '@/components/places/places-screen';

export const metadata: Metadata = { title: 'Places' };
export const dynamic = 'force-dynamic';

export default function PlacesPage() {
  return <PlacesScreen />;
}
