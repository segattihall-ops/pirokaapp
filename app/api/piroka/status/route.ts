import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** PostgREST: relation is not in the schema cache (table missing or migration not applied). */
const MISSING_TABLE = 'PGRST205';

const Body = z.object({
  isActive: z.boolean(),
  destinationCity: z.string().trim().max(120).nullable().optional(),
  appearsInDestination: z.boolean().default(true),
  revealDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
    .nullable()
    .optional(),
});

/**
 * PIROKA Mode (travel mode). Reads and writes go through the user-scoped client so the
 * `travel_mode` RLS policy (owner only) applies; the service role is never used here.
 * The table comes from lib/db/migrations/027_phase20_travel_intelligence.sql. If that
 * migration is not applied the route answers 503 with a clear reason instead of a bare 500.
 */
export async function GET() {
  const supabase = createClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

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
    if (error.code === MISSING_TABLE) {
      console.error('travel_mode table missing: apply lib/db/migrations/027_phase20_travel_intelligence.sql');
      return NextResponse.json({ error: 'Travel mode is not available yet' }, { status: 503 });
    }
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
  const supabase = createClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid travel mode payload' }, { status: 400 });
  }
  const { isActive, destinationCity, appearsInDestination, revealDate } = parsed.data;

  const { error } = await supabase.from('travel_mode').upsert(
    {
      user_id: user.id,
      is_active: isActive,
      destination_city: destinationCity || null,
      appears_in_destination: appearsInDestination,
      reveal_date: revealDate ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    if (error.code === MISSING_TABLE) {
      console.error('travel_mode table missing: apply lib/db/migrations/027_phase20_travel_intelligence.sql');
      return NextResponse.json({ error: 'Travel mode is not available yet' }, { status: 503 });
    }
    console.error('Error updating travel mode:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
