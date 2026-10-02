import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/server';
import { OnboardingClient } from '@/components/onboarding/onboarding-client';

export const metadata: Metadata = { title: 'Onboarding' };
export const dynamic = 'force-dynamic';

/** Five steps: how you show up → who you are → who you want to see → photos → location & privacy. */
export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect('/?gate=1&next=%2Fonboarding');

  // Require age verification before onboarding
  if (!session.user.age_verified) {
    redirect('/auth/age-gate?next=%2Fonboarding');
  }

  return <OnboardingClient />;
}
