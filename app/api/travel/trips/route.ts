import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser } from '@/lib/api/guard';

export const dynamic = 'force-dynamic';

const SaveTripSchema = z.object({
  destinationCity: z.string().min(1).max(100),
  destinationCountry: z.string().max(100).optional(),
  arrivalDate: z.string().datetime().optional(),
  departureDate: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const userId = g.session.userId;

  try {
    const body = await request.json();
    const parsed = SaveTripSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    }

    const { data, error } = await supabaseAdmin
      .from('saved_trips')
      .insert({
        user_id: userId,
        destination_city: parsed.data.destinationCity,
        destination_country: parsed.data.destinationCountry,
        arrival_date: parsed.data.arrivalDate ? new Date(parsed.data.arrivalDate).toISOString().split('T')[0] : null,
        departure_date: parsed.data.departureDate ? new Date(parsed.data.departureDate).toISOString().split('T')[0] : null,
        notes: parsed.data.notes,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to save trip' }, { status: 500 });
    }

    return NextResponse.json({ trip: data });
  } catch (err) {
    console.error('Save trip error:', err);
    return NextResponse.json({ error: 'Failed to save trip' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const userId = g.session.userId;

  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    }

    const { data, error } = await supabaseAdmin
      .from('saved_trips')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('arrival_date', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch trips' }, { status: 500 });
    }

    return NextResponse.json({ trips: data });
  } catch (err) {
    console.error('Fetch trips error:', err);
    return NextResponse.json({ error: 'Failed to fetch trips' }, { status: 500 });
  }
}
