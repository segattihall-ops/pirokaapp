import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { requireAdmin } from '@/lib/admin/guard';

export const dynamic = 'force-dynamic';

/** GET: a map of country → protected (only rows we have; the page defaults the rest to off). */
export async function GET() {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const { data, error } = await supabaseAdmin.from('risk_regions').select('country, enabled');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const regions: Record<string, boolean> = {};
  for (const r of data ?? []) regions[r.country] = r.enabled;
  return NextResponse.json({ regions });
}

const Patch = z.object({ country: z.string().trim().min(1).max(120), enabled: z.boolean() });

/** PATCH: toggle one country's protection. */
export async function PATCH(request: Request) {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const parsed = Patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: 'country and enabled are required' }, { status: 400 });
  const { country, enabled } = parsed.data;

  const { error } = await supabaseAdmin
    .from('risk_regions')
    .upsert(
      { country, enabled, updated_by: g.session.userId, updated_at: new Date().toISOString() },
      { onConflict: 'country' },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from('audit_log').insert({
    actor_id: g.session.userId,
    action: enabled ? 'risk_region.added' : 'risk_region.removed',
    target: country,
    details: null,
  });
  return NextResponse.json({ ok: true });
}
