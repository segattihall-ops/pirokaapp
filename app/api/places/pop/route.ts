import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { isMissingSchema } from '@/lib/db/schema-errors';

export const dynamic = 'force-dynamic';
const Payload = z.object({ placeId: z.string().uuid() });

/** Only a member actually checked in HERE may vote. Never count another person's "going" RSVP. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  const parsed = Payload.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid venue' }, { status: 400 });
  const { placeId } = parsed.data;
  const now = new Date().toISOString();
  const { data: checkin, error: checkinError } = await supabaseAdmin.from('checkins')
    .select('expires_at').eq('place_id', placeId)
    .eq('user_id', session.userId).eq('kind', 'here').gt('expires_at', now).maybeSingle();
  if (checkinError) return NextResponse.json({ error: 'Could not verify check-in' }, { status: 500 });
  if (!checkin) return NextResponse.json({ error: 'Check in here before voting' }, { status: 403 });

  const { error } = await supabaseAdmin.from('place_pop_votes').upsert({
    place_id: placeId, user_id: session.userId, expires_at: checkin.expires_at,
  }, { onConflict: 'place_id,user_id' });
  if (error && isMissingSchema(error)) {
    return NextResponse.json({ error: 'Popping votes require database migration 041', schemaPending: true }, { status: 503 });
  }
  if (error) return NextResponse.json({ error: 'Could not record vote' }, { status: 500 });
  const { count } = await supabaseAdmin.from('place_pop_votes')
    .select('user_id', { count: 'exact', head: true })
    .eq('place_id', placeId).gt('expires_at', now);
  return NextResponse.json({ ok: true, votes: count ?? 0, popping: (count ?? 0) >= 5 });
}
