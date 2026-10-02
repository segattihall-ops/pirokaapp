import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/server';
import { AgeGate } from '@/components/auth/age-gate';

export const metadata: Metadata = { title: 'Age Confirmation' };
export const dynamic = 'force-dynamic';

export default async function AgeGatePage() {
  const session = await getSession();

  // Already verified → redirect to onboarding
  if (session?.user?.age_verified) {
    redirect('/onboarding');
  }

  // Not authenticated → redirect to login
  if (!session) {
    redirect('/auth/login?next=%2Fauth%2Fage-gate');
  }

  return <AgeGate />;
}
