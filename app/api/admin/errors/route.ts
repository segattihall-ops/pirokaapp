import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireAdmin } from '@/lib/admin/guard';
import { withApi } from '@/lib/errors/server';

export const dynamic = 'force-dynamic';

export const GET = withApi('/api/admin/errors', async (request: Request) => {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  if (!supabaseAdmin) return NextResponse.json({ errors: [] });
  const show = new URL(request.url).searchParams.get('show') ?? 'open';
  let q = supabaseAdmin.from('error_events').select('*').order('last_seen', { ascending: false }).limit(200);
  if (show === 'open') q = q.is('resolved_at', null);
  else if (show === 'resolved') q = q.not('resolved_at', 'is', null);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ errors: data ?? [] });
});

export const PATCH = withApi('/api/admin/errors', async (request: Request) => {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  const { id, resolved } = (await request.json().catch(() => ({}))) as { id?: number; resolved?: boolean };
  if (typeof id !== 'number') return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { error } = await supabaseAdmin.from('error_events').update({ resolved_at: resolved === false ? null : new Date().toISOString() }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
