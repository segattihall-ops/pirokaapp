import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser } from '@/lib/api/guard';
import { hasDrugTerms, DRUG_TERMS_MESSAGE } from '@/lib/moderation/drug-words';
import { eitherHeld } from '@/lib/safety/hold-db';

export const dynamic = 'force-dynamic';

const coarse = (v: number) => Math.round(v * 100) / 100;

const RADIUS_M = 8047; // 5 miles, as the board is described in FEATURES §7
const Body = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  content: z.string().trim().min(1).max(280),
  parentId: z.number().int().positive().optional(),
});

/** Post a public message to the area, or a reply to an existing post (`parentId`). */
export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const session = g.session;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const { lat, lon, content, parentId } = parsed.data;
  if (hasDrugTerms(content)) return NextResponse.json({ error: DRUG_TERMS_MESSAGE }, { status: 422 });
  if (await eitherHeld(session.userId)) return NextResponse.json({ error: 'Not available' }, { status: 403 });

  // A reply must hang off a real top-level post — replies are one level deep, never a reply to a reply.
  if (parentId !== undefined) {
    const { data: parent } = await supabaseAdmin!
      .from('area_messages')
      .select('id, parent_id')
      .eq('id', parentId)
      .maybeSingle();
    if (!parent || parent.parent_id !== null)
      return NextResponse.json({ error: 'That post is no longer available' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin!
    .from('area_messages')
    // The board is public to everyone nearby, so only a ~1 km grid cell is kept, never the exact spot.
    .insert({
      author_id: session.userId,
      lat: coarse(lat),
      lon: coarse(lon),
      content,
      parent_id: parentId ?? null,
    })
    .select('id, author_id, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, created_at: data.created_at });
}

/** Get messages in a geographic area (5 mi radius). */
export async function GET(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;

  const url = new URL(request.url);

  // Thread view: the replies under one top-level post, oldest first. No distance — a reply inherits
  // its parent's place in the board.
  const parentIdRaw = url.searchParams.get('parentId');
  if (parentIdRaw) {
    const parentId = Number(parentIdRaw);
    if (!Number.isInteger(parentId) || parentId <= 0)
      return NextResponse.json({ error: 'parentId invalid' }, { status: 400 });
    const { data, error } = await supabaseAdmin!
      .from('area_messages')
      .select('id, author_id, content, created_at')
      .eq('parent_id', parentId)
      .order('created_at', { ascending: true })
      .limit(100);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ replies: data ?? [] });
  }

  const lat = parseFloat(url.searchParams.get('lat') ?? '0');
  const lon = parseFloat(url.searchParams.get('lon') ?? '0');

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180)
    return NextResponse.json({ error: 'lat,lon required' }, { status: 400 });

  const { data, error } = await supabaseAdmin!
    .rpc('nearby_area_messages', { p_lat: lat, p_lon: lon, p_radius_m: RADIUS_M })
    .select('id, author_id, content, created_at, distance_m')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  type Row = { id: number; author_id: string; content: string; created_at: string; distance_m: number };
  const rows = (data ?? []) as Row[];

  // Reply counts in one grouped read (the RPC only returns top-level posts). Keeps the function's
  // signature unchanged so no destructive DROP is needed to add threading.
  const counts = new Map<number, number>();
  if (rows.length) {
    const { data: reps } = await supabaseAdmin!
      .from('area_messages')
      .select('parent_id')
      .in(
        'parent_id',
        rows.map((r) => r.id),
      );
    for (const r of reps ?? [])
      if (r.parent_id != null) counts.set(r.parent_id, (counts.get(r.parent_id) ?? 0) + 1);
  }
  const messages = rows.map((r) => ({ ...r, reply_count: counts.get(r.id) ?? 0 }));
  return NextResponse.json({ messages });
}

export async function DELETE(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const { messageId } = (await request.json().catch(() => ({}))) as { messageId?: number };
  if (!messageId) return NextResponse.json({ error: 'messageId required' }, { status: 400 });

  const { error } = await supabaseAdmin!
    .from('area_messages')
    .delete()
    .eq('id', messageId)
    .eq('author_id', g.session.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
