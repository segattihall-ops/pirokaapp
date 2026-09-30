import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { isUuid, requireUser } from '@/lib/api/guard';

export const dynamic = 'force-dynamic';

const Body = z.object({ status: z.enum(['interested', 'going', 'maybe']).optional() });

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (g.error) return g.error;
  const me = g.session.userId;

  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const body = await request.json();
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const { status = 'going' } = parsed.data;

  // Check event exists
  const { data: event, error: eventErr } = await supabaseAdmin
    .from('events')
    .select('id, max_attendees')
    .eq('id', params.id)
    .single();

  if (eventErr) {
    if (eventErr.code === 'PGRST116') return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    return NextResponse.json({ error: eventErr.message }, { status: 500 });
  }

  // Check if already RSVP'd
  const { data: existing } = await supabaseAdmin
    .from('event_attendees')
    .select('status')
    .eq('event_id', params.id)
    .eq('user_id', me)
    .maybeSingle();

  if (existing) {
    // Update existing RSVP
    const { error } = await supabaseAdmin
      .from('event_attendees')
      .update({ status })
      .eq('event_id', params.id)
      .eq('user_id', me);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ rsvp: { status } });
  }

  // Check capacity if max_attendees is set
  if (event.max_attendees) {
    const { count } = await supabaseAdmin
      .from('event_attendees')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', params.id);

    if (count && count >= event.max_attendees) {
      return NextResponse.json({ error: 'Event is full' }, { status: 409 });
    }
  }

  // Create RSVP
  const { data: rsvp, error } = await supabaseAdmin
    .from('event_attendees')
    .insert({ event_id: params.id, user_id: me, status })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ rsvp }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (g.error) return g.error;
  const me = g.session.userId;

  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const { error } = await supabaseAdmin
    .from('event_attendees')
    .delete()
    .eq('event_id', params.id)
    .eq('user_id', me);

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
