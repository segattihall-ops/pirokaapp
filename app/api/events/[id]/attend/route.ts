import { NextResponse } from 'next/server';
import { z } from 'zod';

import { isUuid, requireUser } from '@/lib/api/guard';
import { supabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

const Body = z.object({
  status: z.enum(['interested', 'going', 'maybe']).default('going'),
});

async function setRsvp(
  request: Request,
  params: { id: string },
  mode: 'create-or-update' | 'update-only',
) {
  const g = await requireUser();
  if (g.error) return g.error;

  if (!isUuid(params.id)) {
    return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
  }
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const { data: event, error: eventError } = await supabaseAdmin
    .from('events')
    .select('id,max_attendees')
    .eq('id', params.id)
    .single();

  if (eventError || !event) {
    if (eventError?.code === 'PGRST116') {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to load event' }, { status: 500 });
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('event_attendees')
    .select('status')
    .eq('event_id', params.id)
    .eq('user_id', g.session.userId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: 'Failed to read RSVP' }, { status: 500 });
  }

  if (existing) {
    const { data: rsvp, error } = await supabaseAdmin
      .from('event_attendees')
      .update({ status: parsed.data.status })
      .eq('event_id', params.id)
      .eq('user_id', g.session.userId)
      .select('status')
      .single();

    if (error) return NextResponse.json({ error: 'Failed to update RSVP' }, { status: 500 });
    return NextResponse.json({ rsvp });
  }

  if (mode === 'update-only') {
    return NextResponse.json({ error: 'RSVP not found' }, { status: 404 });
  }

  if (event.max_attendees) {
    const { count } = await supabaseAdmin
      .from('event_attendees')
      .select('user_id', { count: 'exact', head: true })
      .eq('event_id', params.id)
      .eq('status', 'going');

    if ((count ?? 0) >= event.max_attendees && parsed.data.status === 'going') {
      return NextResponse.json({ error: 'Event is full' }, { status: 409 });
    }
  }

  const { data: rsvp, error } = await supabaseAdmin
    .from('event_attendees')
    .insert({
      event_id: params.id,
      user_id: g.session.userId,
      status: parsed.data.status,
    })
    .select('status')
    .single();

  if (error) return NextResponse.json({ error: 'Failed to RSVP' }, { status: 500 });
  return NextResponse.json({ rsvp }, { status: 201 });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  return setRsvp(request, params, 'create-or-update');
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  return setRsvp(request, params, 'update-only');
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (g.error) return g.error;

  if (!isUuid(params.id)) {
    return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
  }
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const { error } = await supabaseAdmin
    .from('event_attendees')
    .delete()
    .eq('event_id', params.id)
    .eq('user_id', g.session.userId);

  if (error) return NextResponse.json({ error: 'Failed to remove RSVP' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
