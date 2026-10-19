import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isUuid, requireUser } from '@/lib/api/guard';
import { supabaseAdmin } from '@/lib/db/client';
import { ensureUserRow } from '@/lib/db/users';
import { isMissingSchema, schemaPendingResponse } from '@/lib/db/schema-errors';
import { DRUG_TERMS_MESSAGE, hasDrugTerms } from '@/lib/moderation/drug-words';
import { displayName, userCards } from '@/lib/users/cards';

export const dynamic = 'force-dynamic';

export type PlaceChatMessage = {
  id: number;
  userId: string | null;
  name: string;
  mine: boolean;
  body: string;
  createdAt: string;
};

const room = (placeId: string) => `p:${placeId}`;
const Body = z.object({ body: z.string().trim().min(1).max(280) });

/** Live place chat: plain text, moderated (not E2E), the last 60 messages from the past 12 hours. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (g.error) return g.error;
  const db = supabaseAdmin!;
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invalid place' }, { status: 400 });

  const since = new Date(Date.now() - 12 * 3600_000).toISOString();
  const { data, error } = await db
    .from('room_messages')
    .select('id, user_id, body, created_at')
    .eq('room', room(params.id))
    .gt('created_at', since)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) {
    if (isMissingSchema(error)) return NextResponse.json(schemaPendingResponse('001_schema'), { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const rows = (data ?? []).reverse();
  const cards = await userCards(rows.map((r) => r.user_id).filter((x): x is string => Boolean(x)));
  const messages: PlaceChatMessage[] = rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    name: r.user_id ? displayName(cards.get(r.user_id)?.handle) : 'Member',
    mine: r.user_id === g.session.userId,
    body: r.body,
    createdAt: r.created_at,
  }));
  return NextResponse.json({ messages });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (g.error) return g.error;
  const db = supabaseAdmin!;
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invalid place' }, { status: 400 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Say something (up to 280 characters).' }, { status: 400 });
  if (hasDrugTerms(parsed.data.body)) return NextResponse.json({ error: DRUG_TERMS_MESSAGE }, { status: 422 });

  const { data: place } = await db.from('places').select('id').eq('id', params.id).maybeSingle();
  if (!place) return NextResponse.json({ error: 'Place not found' }, { status: 404 });

  // Light rate limit: 10 messages per minute per member across rooms.
  const minuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count } = await db
    .from('room_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', g.session.userId)
    .gt('created_at', minuteAgo);
  if ((count ?? 0) >= 10) return NextResponse.json({ error: 'Slow down a little.' }, { status: 429 });

  await ensureUserRow(g.session);
  const { data, error } = await db
    .from('room_messages')
    .insert({ room: room(params.id), user_id: g.session.userId, body: parsed.data.body })
    .select('id, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, createdAt: data.created_at });
}
