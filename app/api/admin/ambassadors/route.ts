import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireAdmin } from '@/lib/admin/guard';

export const dynamic = 'force-dynamic';

const STATUSES = ['open', 'active', 'declined', 'removed'] as const;

export async function GET(request: Request) {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const status = new URL(request.url).searchParams.get('status');
  let q = supabaseAdmin
    .from('ambassadors')
    .select('id, user_id, handle, city, hours, why, status, actions, agree, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (status && (STATUSES as readonly string[]).includes(status)) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ambassadors: (data ?? []).map((a) => ({
      id: a.id,
      user: a.handle ?? a.user_id?.slice(0, 8) ?? 'member',
      city: a.city,
      hours: a.hours ?? '—',
      why: a.why ?? '',
      status: a.status,
      actions: a.actions ?? 0,
      agree: a.agree ?? 0,
    })),
  });
}

export async function PATCH(request: Request) {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const { id, status } = (await request.json().catch(() => ({}))) as { id?: string; status?: string };
  if (!id || !status || !(['active', 'declined', 'removed'] as string[]).includes(status)) {
    return NextResponse.json({ error: 'id and a valid status are required' }, { status: 400 });
  }
  const { error } = await supabaseAdmin
    .from('ambassadors')
    .update({ status, reviewer_id: g.session.userId, decided_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from('audit_log').insert({
    actor_id: g.session.userId,
    action: `ambassador.${status}`,
    target: id,
    details: null,
  });
  return NextResponse.json({ ok: true });
}
