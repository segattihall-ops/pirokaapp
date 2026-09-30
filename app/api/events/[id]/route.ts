import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { isUuid, requireUser } from '@/lib/api/guard';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const { data: event, error } = await supabaseAdmin
    .from('events')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch attendees separately
  const { data: attendees, error: attErr } = await supabaseAdmin
    .from('event_attendees')
    .select('user_id, status, rsvp_at')
    .eq('event_id', params.id);

  if (attErr) {
    console.error('attendees fetch error:', attErr);
    return NextResponse.json({ event: { ...event, event_attendees: [] } });
  }

  return NextResponse.json({ event: { ...event, event_attendees: attendees || [] } });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (g.error) return g.error;
  const me = g.session.userId;

  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const { data: event, error: getErr } = await supabaseAdmin
    .from('events')
    .select('creator_id')
    .eq('id', params.id)
    .single();

  if (getErr) {
    if (getErr.code === 'PGRST116') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ error: getErr.message }, { status: 500 });
  }

  if (event.creator_id !== me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { error } = await supabaseAdmin.from('events').delete().eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
