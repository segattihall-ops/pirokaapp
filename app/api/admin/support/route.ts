import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireAdmin } from '@/lib/admin/guard';

export const dynamic = 'force-dynamic';

const STATUSES = ['open', 'replied', 'escalated', 'resolved'] as const;

export async function GET(request: Request) {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const status = new URL(request.url).searchParams.get('status');
  let q = supabaseAdmin
    .from('support_tickets')
    .select('id, user_id, handle, email, topic, lang, body, plan, status, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (status && (STATUSES as readonly string[]).includes(status)) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    tickets: (data ?? []).map((t) => ({
      id: t.id,
      user: t.handle ?? t.email ?? t.user_id?.slice(0, 8) ?? 'guest',
      lang: t.lang ?? 'EN',
      topic: t.topic,
      msg: t.body,
      prem: t.plan === 'plus' || t.plan === 'premium',
      age: Math.max(1, Math.round((Date.now() - new Date(t.created_at).getTime()) / 60000)),
      status: t.status,
    })),
  });
}

export async function PATCH(request: Request) {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const { id, status, reply } = (await request.json().catch(() => ({}))) as {
    id?: string;
    status?: string;
    reply?: string;
  };
  if (!id || !status || !(STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: 'id and a valid status are required' }, { status: 400 });
  }

  const replying = status === 'replied';
  const { error } = await supabaseAdmin
    .from('support_tickets')
    .update({
      status,
      reply: replying ? (reply ?? null) : undefined,
      replied_at: replying ? new Date().toISOString() : undefined,
      handled_by: g.session.userId,
    })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from('audit_log').insert({
    actor_id: g.session.userId,
    action: `support.${status}`,
    target: id,
    details: null,
  });
  return NextResponse.json({ ok: true });
}
