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

    const { placeId, kind } = await request.json() as {
      placeId: string;
      kind: 'here' | 'going';
    };

    if (!placeId || !['here', 'going'].includes(kind)) {
      return Response.json({ error: 'Invalid params' }, { status: 400 });
    }

    const ttlMinutes = kind === 'here' ? 240 : 1440;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

    const place = await supabaseAdmin
      .from('places')
      .select('id, name, lat, lng')
      .eq('id', placeId)
      .single();

    if (place.error) {
      return Response.json({ error: 'Place not found' }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from('place_checkins')
      .upsert({
        user_id: session.userId,
        place_id: placeId,
        kind,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      console.error('Checkin error:', error);
      return Response.json({ error: 'Checkin failed' }, { status: 500 });
    }

    return Response.json({
      success: true,
      checkin: data,
      expiresAt,
    });
  } catch (error) {
    console.error('Checkin error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return Response.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { placeId } = await request.json() as { placeId: string };

    if (!placeId) {
      return Response.json({ error: 'Place ID required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('place_checkins')
      .delete()
      .eq('user_id', session.userId)
      .eq('place_id', placeId);

    if (error) {
      console.error('Checkout error:', error);
      return Response.json({ error: 'Checkout failed' }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Checkout error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
