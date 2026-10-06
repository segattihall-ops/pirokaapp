import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('travel_mode')
    .select('is_active, destination_city, appears_in_destination, reveal_date')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching travel mode:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(null);
  }

  return NextResponse.json({
    isActive: data.is_active,
    destinationCity: data.destination_city,
    appearsInDestination: data.appears_in_destination,
    revealDate: data.reveal_date,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { isActive, destinationCity, appearsInDestination, revealDate } = body;

  const { error } = await supabase.from('travel_mode').upsert(
    {
      user_id: user.id,
      is_active: isActive,
      destination_city: destinationCity,
      appears_in_destination: appearsInDestination,
      reveal_date: revealDate,
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    console.error('Error updating travel mode:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
