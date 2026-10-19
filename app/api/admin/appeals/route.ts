import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireAdmin } from '@/lib/admin/guard';

export const dynamic = 'force-dynamic';

const STATUSES = ['pending', 'granted', 'denied'] as const;

/**
 * Appeals queue: a member contests a moderation action. Joined to the mod_action it is about
 * (keyed by action_id) so the reviewer sees the original step, rule and user.
 */
export async function GET(request: Request) {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const status = new URL(request.url).searchParams.get('status');
  let q = supabaseAdmin
    .from('appeals')
    .select(
      'action_id, body, status, created_at, action:mod_actions!appeals_action_id_fkey(step, rule_ref, user_id, user:users!mod_actions_user_id_fkey(handle))',
    )
    .order('created_at', { ascending: false })
    .limit(200);
  if (status && (STATUSES as readonly string[]).includes(status)) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const one = <T>(v: unknown) => (Array.isArray(v) ? v[0] : v) as T | null;
  return NextResponse.json({
    appeals: (data ?? []).map((r) => {
      const a = one<{ step: string; rule_ref: string; user_id: string; user: unknown }>(r.action);
      return {
        id: r.action_id,
        userId: a?.user_id ?? null,
        userHandle: one<{ handle: string | null }>(a?.user)?.handle ?? null,
        action: a?.step ?? '—',
        rule: a?.rule_ref ?? '—',
        body: r.body,
        status: r.status,
        createdAt: r.created_at,
      };
    }),
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
  const { error } = await supabaseAdmin
    .from('appeals')
    .update({ status, reviewer_id: g.session.userId })
    .eq('action_id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin
    .from('audit_log')
    .insert({ actor_id: g.session.userId, action: `appeal.${status}`, target: id, details: null });
  return NextResponse.json({ ok: true });
}
