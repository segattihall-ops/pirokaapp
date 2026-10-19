import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/api/guard';
import { supabaseAdmin } from '@/lib/db/client';
import { ensureUserRow } from '@/lib/db/users';
import { isMissingSchema, schemaPendingResponse } from '@/lib/db/schema-errors';

export const dynamic = 'force-dynamic';

const Body = z.object({
  placeId: z.string().uuid(),
  kind: z.enum(['here', 'going']),
  /** Minutes until arrival for "going": 15, 30 or 60. */
  etaMin: z.union([z.literal(15), z.literal(30), z.literal(60)]).optional(),
});
const HERE_MIN = 240;
/** A "going" check-in stays visible until two hours after the promised arrival. */
const GOING_GRACE_MIN = 120;

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

/**
 * "I'm here" lasts 4 h. "I'm going" takes an ETA (15 / 30 / 60 min) and expires 2 h after it —
 * reaching that expiry without a "here" counts as a no-show; two in 30 days pause "going" for 5 days.
 * One active "here" per member (you can only be in one place).
 */
export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const db = supabaseAdmin!;
  const me = g.session.userId;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'placeId and kind required' }, { status: 400 });
  const { placeId, kind } = parsed.data;
  const etaMin = parsed.data.etaMin ?? 30;

  const { data: place } = await db.from('places').select('id').eq('id', placeId).maybeSingle();
  if (!place) return NextResponse.json({ error: 'Place not found' }, { status: 404 });

  await ensureUserRow(g.session);
  await db.rpc('record_no_shows').then(() => undefined, () => undefined);

  if (kind === 'going') {
    const { data: u, error } = await db.from('users').select('going_paused_until').eq('id', me).maybeSingle();
    if (error && isMissingSchema(error))
      return NextResponse.json(schemaPendingResponse('040_places_v2'), { status: 503 });
    const paused = u?.going_paused_until as string | null | undefined;
    if (paused && new Date(paused).getTime() > Date.now()) {
      return NextResponse.json(
        { error: `I'm going is paused until ${fmtDay(paused)} after two no-shows.`, pausedUntil: paused },
        { status: 403 },
      );
    }
  }

  const now = Date.now();
  const etaAt = kind === 'going' ? new Date(now + etaMin * 60_000).toISOString() : null;
  const expiresAt = new Date(
    kind === 'here' ? now + HERE_MIN * 60_000 : now + (etaMin + GOING_GRACE_MIN) * 60_000,
  ).toISOString();

  if (kind === 'here') {
    await db.from('checkins').delete().eq('user_id', me).eq('kind', 'here');
    await db.from('place_pop_votes').delete().eq('user_id', me).neq('place_id', placeId);
  } else {
    await db.from('place_pop_votes').delete().eq('user_id', me).eq('place_id', placeId);
  }
  const { error } = await db
    .from('checkins')
    .upsert({ user_id: me, place_id: placeId, kind, expires_at: expiresAt, eta_at: etaAt }, { onConflict: 'user_id,place_id' });
  if (error) {
    if (isMissingSchema(error)) return NextResponse.json(schemaPendingResponse('040_places_v2'), { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, kind, expiresAt, etaAt });
}

/** Leaving / cancelling "going" before the ETA is not a no-show. */
export async function DELETE(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const { placeId } = (await request.json().catch(() => ({}))) as { placeId?: string };
  if (!placeId) return NextResponse.json({ error: 'placeId required' }, { status: 400 });
  await supabaseAdmin!.from('checkins').delete().eq('user_id', g.session.userId).eq('place_id', placeId);
  await supabaseAdmin!.from('place_pop_votes').delete().eq('user_id', g.session.userId).eq('place_id', placeId);
  return NextResponse.json({ ok: true });
}
