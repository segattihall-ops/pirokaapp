import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/server';
import { isAdmin } from '@/lib/auth/admin';
import { supabaseAdmin } from '@/lib/db/client';
import { listingsFor, requireListing } from '@/lib/partners/server';
import type { Listing } from '@/lib/partners/shared';
import { PartnerDashboard } from '@/components/partners/dashboard';
import { PartnerClaim } from '@/components/partners/claim';
import { PartnerHeader } from '@/components/partners/header';

export const dynamic = 'force-dynamic';

/**
 * /partners — the listing(s) a member manages. Admins may open any listing with ?place=<uuid>
 * (or ?site=<id> for a clinic). Members with no listing see "Claim your listing".
 */
export default async function PartnersPage({
  searchParams,
}: {
  searchParams: { place?: string; site?: string };
}) {
  const session = await getSession();
  if (!session) redirect('/?gate=1&next=%2Fpartners');

  if (!supabaseAdmin) {
    return (
      <>
        <PartnerHeader listings={[]} />
        <main className="mx-auto flex w-full max-w-[960px] flex-col gap-4 px-4 py-6">
          <p className="rounded-input border border-dashed border-line-2 px-3.5 py-3 text-[13px] text-fg-3">
            The partner portal needs Supabase — add the keys and run migration 039.
          </p>
        </main>
      </>
    );
  }

  let listings: Listing[] = [];
  let schemaPending = false;
  const mine = await listingsFor(session.userId);
  if (mine.error) schemaPending = mine.error.status === 503;
  else listings = mine.listings;

  // Admins can open any listing to help a partner.
  if (isAdmin(session) && (searchParams.place || searchParams.site)) {
    const key = searchParams.place ? `place:${searchParams.place}` : `testing_site:${searchParams.site}`;
    const one = await requireListing(session, key);
    if (one.listing && !listings.some((l) => l.key === one.listing!.key)) listings = [one.listing, ...listings];
  }

  if (schemaPending) {
    return (
      <>
        <PartnerHeader listings={[]} />
        <main className="mx-auto flex w-full max-w-[960px] flex-col gap-4 px-4 py-6">
          <p className="rounded-input border border-dashed border-line-2 px-3.5 py-3 text-[13px] text-fg-3">
            The partner portal is almost ready — a database update (039) has not been applied yet.
          </p>
        </main>
      </>
    );
  }

  if (!listings.length) {
    return (
      <>
        <PartnerHeader listings={[]} />
        <PartnerClaim />
      </>
    );
  }

  return <PartnerDashboard listings={listings} />;
}
