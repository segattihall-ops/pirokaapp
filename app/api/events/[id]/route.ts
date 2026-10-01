import { NextResponse } from 'next/server';

import { isUuid, requireUser } from '@/lib/api/guard';
import { supabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (g.error) return g.error;

  if (!isUuid(params.id)) {
    return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
  }
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const [{ data: event, error }, { count }, { data: mine }] = await Promise.all([
    supabaseAdmin
      .from('events')
      .select(
        'id,creator_id,title,description,location_name,photo,starts_at,ends_at,category,max_attendees,created_at,updated_at',
      )
      .eq('id', params.id)
      .single(),
    supabaseAdmin
      .from('event_attendees')
      .select('user_id', { count: 'exact', head: true })
      .eq('event_id', params.id),
    supabaseAdmin
      .from('event_attendees')
      .select('status')
      .eq('event_id', params.id)
      .eq('user_id', g.session.userId)
      .maybeSingle(),
  ]);

  if (error || !event) {
    if (error?.code === 'PGRST116') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to load event' }, { status: 500 });
  }

  return NextResponse.json(
    {
      event: {
        ...event,
        attendee_count: count ?? 0,
        my_rsvp_status: mine?.status ?? null,
      },
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (g.error) return g.error;

  if (!isUuid(params.id)) {
    return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
  }
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const { data, error } = await supabaseAdmin
    .from('events')
    .delete()
    .eq('id', params.id)
    .eq('creator_id', g.session.userId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('delete event error:', error.message);
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
