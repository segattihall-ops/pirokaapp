import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { requireAdmin } from '@/lib/admin/guard';
import { invalidateFlagCache, listFlags } from '@/lib/flags/server';
import { withApi } from '@/lib/errors/server';

export const dynamic = 'force-dynamic';

const Upsert = z.object({
  key: z.string().regex(/^[a-z0-9_]{2,48}$/),
  enabled: z.boolean().optional(),
  rollout_pct: z.number().int().min(0).max(100).optional(),
  description: z.string().max(200).nullable().optional(),
});

export const GET = withApi('/api/admin/flags', async () => {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  return NextResponse.json({ flags: await listFlags(true) });
});

/** Create or update a flag. */
export const PUT = withApi('/api/admin/flags', async (request: Request) => {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  const parsed = Upsert.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: 'key (a-z0-9_), enabled, rollout_pct 0–100' }, { status: 400 });
  const b = parsed.data;
  const { data: existing } = await supabaseAdmin
    .from('feature_flags')
    .select('*')
    .eq('key', b.key)
    .maybeSingle();
  const row = {
    key: b.key,
    enabled: b.enabled ?? existing?.enabled ?? false,
    rollout_pct: b.rollout_pct ?? existing?.rollout_pct ?? 100,
    description: b.description === undefined ? (existing?.description ?? null) : b.description,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabaseAdmin.from('feature_flags').upsert(row, { onConflict: 'key' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  invalidateFlagCache();
  await supabaseAdmin
    .from('audit_log')
    .insert({ actor_id: g.session.userId, action: 'flag.update', target: b.key, details: row });
  return NextResponse.json({ flag: row });
});

export const DELETE = withApi('/api/admin/flags', async (request: Request) => {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  const key = new URL(request.url).searchParams.get('key') ?? '';
  if (!/^[a-z0-9_]{2,48}$/.test(key)) return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
  await supabaseAdmin.from('feature_flags').delete().eq('key', key);
  invalidateFlagCache();
  await supabaseAdmin
    .from('audit_log')
    .insert({ actor_id: g.session.userId, action: 'flag.delete', target: key });
  return NextResponse.json({ ok: true });
});
