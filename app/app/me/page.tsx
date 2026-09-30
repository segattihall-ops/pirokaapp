import type { Metadata } from 'next';
import Link from 'next/link';
import { getSession } from '@/lib/auth/server';
import { isAdmin } from '@/lib/auth/admin';
import { PayPalCheckout } from '@/components/billing/paypal-checkout';
import { PushToggle } from '@/components/push/push-toggle';
import { NotifPrefs } from '@/components/me/notif-prefs';
import { SignOutButton } from '@/components/account/sign-out-button';

export const metadata: Metadata = { title: 'Me' };
export const dynamic = 'force-dynamic';

const ROWS: { label: string; href: string }[] = [
  { label: 'Trust signals', href: '/help/trust' },
  { label: 'SafeMeet', href: '/help/safemeet' },
  { label: 'Privacy & safety', href: '/help/privacy' },
];

export default async function MePage() {
  const session = await getSession();
  if (!session) return null;
  const admin = isAdmin(session);

  return (
    <section className="mx-auto flex w-full max-w-[560px] animate-in flex-col gap-4 px-4 py-6 sm:px-6 sm:py-10">
      <span className="eyebrow">Me</span>
      <h1 className="text-h2 sm:text-h1">Your profile</h1>

      <div className="glass flex items-center justify-between rounded-card px-4 py-3.5">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium">{session.email ?? 'Anonymous'}</p>
          <p className="text-[12px] text-fg-3">
            Signed in with {session.provider}
            {session.ageVerified ? ' · 18+ verified' : ''}
          </p>
        </div>
        <SignOutButton />
      </div>

      <PayPalCheckout userId={session.userId} />

      <PushToggle />

      <NotifPrefs />

      <div className="flex flex-col gap-2">
        {ROWS.map((r) => (
          <Link
            key={r.label}
            href={r.href}
            className="glass flex items-center justify-between rounded-card px-4 py-3.5 text-[14px] font-medium"
          >
            {r.label}
            <span className="text-fg-4">›</span>
          </Link>
        ))}
        {admin && (
          <Link
            href="/admin"
            className="glass flex items-center justify-between rounded-card px-4 py-3.5 text-[14px] font-medium text-green"
          >
            Admin dashboard
            <span className="text-fg-4">›</span>
          </Link>
        )}
      </div>
    </section>
  );
}
