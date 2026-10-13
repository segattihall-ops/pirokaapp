import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireAdmin } from '@/lib/admin/guard';
import { isUuid } from '@/lib/api/guard';
import { withApi } from '@/lib/errors/server';

export const dynamic = 'force-dynamic';

const STATUSES = ['new', 'triaged', 'closed'];

export const GET = withApi('/api/admin/feedback', async (request: Request) => {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  if (!supabaseAdmin) return NextResponse.json({ feedback: [] });
  const status = new URL(request.url).searchParams.get('status');
  let q = supabaseAdmin
    .from('feedback')
    .select(
      'id, user_id, email, kind, message, path, status, created_at, user:users!feedback_user_id_fkey(handle)',
    )
    .order('created_at', { ascending: false })
    .limit(200);
  if (status && STATUSES.includes(status)) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const one = (v: unknown) => (Array.isArray(v) ? v[0] : v) as { handle: string | null } | null;
  return NextResponse.json({
    feedback: (data ?? []).map((f) => ({ ...f, handle: one(f.user)?.handle ?? null, user: undefined })),
  });
});

export const PATCH = withApi('/api/admin/feedback', async (request: Request) => {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  const { id, status } = (await request.json().catch(() => ({}))) as { id?: string; status?: string };
  if (!isUuid(id) || !status || !STATUSES.includes(status))
    return NextResponse.json({ error: 'id and a valid status are required' }, { status: 400 });
  const { error } = await supabaseAdmin.from('feedback').update({ status }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
