import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireAdmin } from '@/lib/admin/guard';

export const dynamic = 'force-dynamic';

/** Venue listings. Members suggest places (unverified); an admin verifies or removes them. */
export async function GET() {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const { data, error } = await supabaseAdmin
    .from('places')
    .select('id, name, kind, peak_hint, verified')
    .order('verified', { ascending: true })
    .order('name', { ascending: true })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    places: (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      kind: p.kind,
      peakHint: p.peak_hint,
      verified: Boolean(p.verified),
    })),
  });
}

export async function PATCH(request: Request) {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const { id, action } = (await request.json().catch(() => ({}))) as { id?: string; action?: string };
  if (!id || (action !== 'verify' && action !== 'remove')) {
    return NextResponse.json({ error: 'id and action (verify|remove) are required' }, { status: 400 });
  }
  const q =
    action === 'remove'
      ? supabaseAdmin.from('places').delete().eq('id', id)
      : supabaseAdmin.from('places').update({ verified: true }).eq('id', id);
  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin
    .from('audit_log')
    .insert({ actor_id: g.session.userId, action: `place.${action}`, target: id, details: null });
  return NextResponse.json({ ok: true });
}
