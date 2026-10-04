import { NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { getSession } from '@/lib/auth/server';
import { saveLocation, supabaseAdmin } from '@/lib/db/client';
import { ensureUserRow } from '@/lib/db/users';
import { fuzzLocation } from '@/lib/geo/fuzz';

export const dynamic = 'force-dynamic';

const Body = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  countryCode: z.string().length(2).optional(),
});

/** Stores the true position server-side and returns only the fuzzed public one. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
  const { lat, lng, countryCode } = parsed.data;

  await ensureUserRow(session);
  const seed = crypto.randomBytes(16);
  const pub = fuzzLocation(lat, lng, seed);
  const { error } = await saveLocation(session.userId, lat, lng, seed, pub.lat, pub.lng, countryCode);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ public: { lat: pub.lat, lng: pub.lng } });
}

/**
 * Renews map presence only. This never reads or changes coordinates and never advances
 * the 24-hour location-retention clock (locations.updated_at).
 */
export async function PATCH() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const { error } = await supabaseAdmin
    .from('locations')
    .update({ presence_at: new Date().toISOString() })
    .eq('user_id', session.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ ok: true });
  await supabaseAdmin.from('locations').delete().eq('user_id', session.userId);
  return NextResponse.json({ ok: true });
}
