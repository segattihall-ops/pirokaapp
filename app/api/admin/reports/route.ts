import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireAdmin } from '@/lib/admin/guard';

export const dynamic = 'force-dynamic';

const STATUSES = ['open', 'under_review', 'resolved', 'dismissed'] as const;

export async function GET(request: Request) {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const status = new URL(request.url).searchParams.get('status');
  let q = supabaseAdmin
    .from('reports')
    .select('id, reporter_id, target_id, reason, details, status, created_at, resolved_at, target:users!reports_target_id_fkey(handle), reporter:users!reports_reporter_id_fkey(handle)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (status && (STATUSES as readonly string[]).includes(status)) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const one = (v: unknown) => (Array.isArray(v) ? v[0] : v) as { handle: string | null } | null;
  return NextResponse.json({
    reports: (data ?? []).map((r) => ({
      id: r.id,
      reporterId: r.reporter_id,
      reporterHandle: one(r.reporter)?.handle ?? null,
      targetId: r.target_id,
      targetHandle: one(r.target)?.handle ?? null,
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: r.created_at,
      resolvedAt: r.resolved_at,
    })),
  });
}

export async function PATCH(request: Request) {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const { id, status } = (await request.json().catch(() => ({}))) as { id?: string; status?: string };
  if (!id || !status || !(STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: 'id and a valid status are required' }, { status: 400 });
  }
  const closing = status === 'resolved' || status === 'dismissed';
  const { error } = await supabaseAdmin
    .from('reports')
    .update({
      status,
      resolved_at: closing ? new Date().toISOString() : null,
      resolved_by: closing ? g.session.userId : null,
    })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from('audit_log').insert({
    actor_id: g.session.userId,
    action: `report.${status}`,
    target: id,
    details: null,
  });
  return NextResponse.json({ ok: true });
}
