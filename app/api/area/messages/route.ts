import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser } from '@/lib/api/guard';

export const dynamic = 'force-dynamic';

const RADIUS_M = 5000;
const Body = z.object({ lat: z.number(), lon: z.number(), content: z.string().min(1).max(500) });

/** Post a public message to the area. */
export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const session = g.session;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const { lat, lon, content } = parsed.data;

  const { data, error } = await supabaseAdmin!
    .from('area_messages')
    .insert({ author_id: session.userId, lat, lon, content })
    .select('id, author_id, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, created_at: data.created_at });
}

/** Get messages in a geographic area (5km radius). */
export async function GET(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;

  const url = new URL(request.url);
  const lat = parseFloat(url.searchParams.get('lat') ?? '0');
  const lon = parseFloat(url.searchParams.get('lon') ?? '0');

  if (!lat || !lon) return NextResponse.json({ error: 'lat,lon required' }, { status: 400 });

  const { data, error } = await supabaseAdmin!
    .rpc('nearby_area_messages', { p_lat: lat, p_lon: lon, p_radius_m: RADIUS_M })
    .select('id, author_id, content, created_at, distance_m')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data ?? [] });
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
