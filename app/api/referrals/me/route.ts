import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/guard';
import { appUrl } from '@/lib/app-url';
import { getOrCreateMyCode, myReferralCount } from '@/lib/referrals/server';

export const dynamic = 'force-dynamic';

/** The signed-in member's invite code, shareable link, and how many friends have joined. */
export async function GET() {
  const g = await requireUser();
  if (g.error) return g.error;

  const code = await getOrCreateMyCode(g.session.userId);
  if (!code) return NextResponse.json({ code: null, url: null, joined: 0 });

  const joined = await myReferralCount(g.session.userId);
  return NextResponse.json({ code, url: appUrl(`/?ref=${code}`), joined });
}
