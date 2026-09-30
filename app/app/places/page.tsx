import type { Metadata } from 'next';
import { PlacesScreen } from '@/components/places/places-screen';

export const metadata: Metadata = { title: 'Places' };

export default function PlacesPage() {
  return <PlacesScreen />;
}
