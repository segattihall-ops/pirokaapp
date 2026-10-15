import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { flagsFor } from '@/lib/flags/server';

export const dynamic = 'force-dynamic';

/** Flags resolved for the current user (or the anonymous bucket). Keys only, no descriptions. */
export async function GET() {
  const session = await getSession();
  const flags = await flagsFor(session?.userId ?? null);
  return NextResponse.json({ flags }, { headers: { 'Cache-Control': 'private, max-age=30' } });
}
