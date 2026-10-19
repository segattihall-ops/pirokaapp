import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/server';
import { PlanBilling } from '@/components/billing/plan-billing';

export const metadata: Metadata = { title: 'Plan & billing' };
export const dynamic = 'force-dynamic';

export default async function PlanPage() {
  const session = await getSession();
  if (!session) redirect('/');
  return (
    <section className="mx-auto flex w-full max-w-[560px] animate-in flex-col gap-4 px-4 py-6 sm:px-6 sm:py-10">
      <Link href="/app/me" className="tap-link text-[13px] font-medium text-fg-3 hover:text-fg">
        ‹ Me
      </Link>
      <span className="eyebrow">Plans</span>
      <h1 className="text-h2 sm:text-h1">Plan &amp; billing</h1>
      <PlanBilling userId={session.userId} />
    </section>
  );
}
