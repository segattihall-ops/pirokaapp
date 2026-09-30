import type { Metadata } from 'next';
import Link from 'next/link';
import { getSession } from '@/lib/auth/server';
import { isAdmin } from '@/lib/auth/admin';
import { PayPalCheckout } from '@/components/billing/paypal-checkout';
import { PushToggle } from '@/components/push/push-toggle';
import { NotifPrefs } from '@/components/me/notif-prefs';
import { SignOutButton } from '@/components/account/sign-out-button';
import { AlbumInbox } from '@/components/me/album-inbox';
import { FavoritesList } from '@/components/me/favorites-list';
import { TripsList } from '@/components/me/trips-list';
import { DeleteAccount } from '@/components/me/delete-account';
import { supabaseAdmin } from '@/lib/db/client';
import { photoUrl } from '@/lib/upload/storage';

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
  const [{ data: me }, { data: photo }] = supabaseAdmin
    ? await Promise.all([
        supabaseAdmin.from('users').select('handle').eq('id', session.userId).maybeSingle(),
        supabaseAdmin.from('photos').select('storage_key').eq('user_id', session.userId).eq('slot', 0).maybeSingle(),
      ])
    : [{ data: null }, { data: null }];
  const handle = me?.handle ?? null;
  const mainPhoto = photo?.storage_key ? photoUrl(photo.storage_key) : null;

  return (
    <section className="mx-auto flex w-full max-w-[560px] animate-in flex-col gap-4 px-4 py-6 sm:px-6 sm:py-10">
      <span className="eyebrow">Me</span>
      <h1 className="text-h2 sm:text-h1">Your profile</h1>

      <div className="glass flex items-center gap-3 rounded-card px-4 py-3.5">
        <Link href="/app/me/edit" aria-label="Edit profile" className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[14px] bg-ink-800">
          {mainPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mainPhoto} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[22px] font-bold text-fg-3">{(handle ?? '?').slice(0, 1).toUpperCase()}</span>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{handle ? `@${handle}` : 'Anonymous'}</p>
          <p className="truncate text-[12px] text-fg-3">
            {session.email ?? session.provider}
            {session.ageVerified ? ' · 18+ verified' : ''}
          </p>
          <Link href="/app/me/edit" className="tap-link text-[12px] font-semibold text-green">
            Edit profile ›
          </Link>
        </div>
        <SignOutButton />
      </div>

      <AlbumInbox />

      <FavoritesList />

      <TripsList />

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

      <DeleteAccount />
    </section>
  );
}
