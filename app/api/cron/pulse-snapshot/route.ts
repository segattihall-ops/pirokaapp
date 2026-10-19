import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

/**
 * Hourly Pulse snapshot (vercel.json cron). Records how many members are active per coarse cell into
 * activity_snapshots, which the Trends tab reads. Also hittable by any scheduler with
 * `Authorization: Bearer $CRON_SECRET`. Aggregate counts only — no identities, no precise location.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization') ?? '';
  if (!secret || auth !== `Bearer ${secret}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const { error } = await supabaseAdmin.rpc('pulse_snapshot');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
