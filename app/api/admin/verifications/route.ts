import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireAdmin } from '@/lib/admin/guard';

export const dynamic = 'force-dynamic';

const STATUSES = ['open', 'approved', 'rejected', 'resubmit'] as const;

/** Verification queue: items the AI could not confirm (age / photo / phone / health). */
export async function GET(request: Request) {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const status = new URL(request.url).searchParams.get('status');
  let q = supabaseAdmin
    .from('verifications')
    .select('id, user_id, kind, ai_result, status, decided_at, user:users!verifications_user_id_fkey(handle)')
    .order('decided_at', { ascending: false, nullsFirst: true })
    .limit(200);
  if (status && (STATUSES as readonly string[]).includes(status)) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const one = (v: unknown) => (Array.isArray(v) ? v[0] : v) as { handle: string | null } | null;
  const detailOf = (r: Record<string, unknown>): string => {
    const ai = r.ai_result as { reason?: string; confidence?: number } | null;
    if (ai?.reason) return ai.reason;
    if (typeof ai?.confidence === 'number') return `AI confidence ${Math.round(ai.confidence * 100)}%`;
    return 'Needs a human review.';
  };
  return NextResponse.json({
    verifications: (data ?? []).map((r) => ({
      id: r.id,
      userId: r.user_id,
      userHandle: one(r.user)?.handle ?? null,
      kind: r.kind,
      detail: detailOf(r),
      status: r.status,
      decidedAt: r.decided_at,
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
  const closing = status !== 'open';
  const { error } = await supabaseAdmin
    .from('verifications')
    .update({ status, reviewer_id: g.session.userId, decided_at: closing ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin
    .from('audit_log')
    .insert({ actor_id: g.session.userId, action: `verification.${status}`, target: id, details: null });
  return NextResponse.json({ ok: true });
}
