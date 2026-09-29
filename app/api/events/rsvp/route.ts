import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return Response.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { eventId, status } = await request.json() as {
      eventId: string;
      status: 'going' | 'maybe' | 'not_going' | 'cancelled';
    };

    if (!eventId || !['going', 'maybe', 'not_going', 'cancelled'].includes(status)) {
      return Response.json({ error: 'Invalid params' }, { status: 400 });
    }

    const event = await supabaseAdmin
      .from('events')
      .select('id, name, start_time')
      .eq('id', eventId)
      .single();

    if (event.error) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from('event_rsvps')
      .upsert({
        user_id: session.userId,
        event_id: eventId,
        status,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('RSVP error:', error);
      return Response.json({ error: 'RSVP failed' }, { status: 500 });
    }

    return Response.json({
      success: true,
      rsvp: data,
    });
  } catch (error) {
    console.error('RSVP error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return Response.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    let query = supabaseAdmin
      .from('event_rsvps')
      .select('*')
      .eq('user_id', session.userId);

    if (eventId) {
      query = query.eq('event_id', eventId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Query error:', error);
      return Response.json({ error: 'Query failed' }, { status: 500 });
    }

    return Response.json({ rsvps: data });
  } catch (error) {
    console.error('Query error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
