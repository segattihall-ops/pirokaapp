import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { ensureUserRow } from '@/lib/db/users';

export const dynamic = 'force-dynamic';

const REPORT_REASONS =['harassment', 'spam', 'underage', 'impersonation', 'hate', 'unsafe', 'other'] as const;

const Body = z.object({
  targetId: z.string().uuid(),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(2000).optional(),
  conversationId: z.string().uuid().optional(),
});

/** Files a report for the moderation queue. Evidence stays client-side unless the reporter pastes it in `details`. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid report' }, { status: 400 });
  const { targetId, reason, details, conversationId } = parsed.data;
  if (targetId === session.userId) return NextResponse.json({ error: 'Cannot report yourself' }, { status: 400 });

  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await supabaseAdmin
    .from('reports')
    .select('id', { count: 'exact', head: true })
    .eq('reporter_id', session.userId)
    .gte('created_at', hourAgo);
  if ((count ?? 0) >= 10) return NextResponse.json({ error: 'Too many reports, try later' }, { status: 429 });

  await ensureUserRow(session);
  const { data, error } = await supabaseAdmin
    .from('reports')
    .insert({
      reporter_id: session.userId,
      target_id: targetId,
      reason,
      details: details || null,
      evidence: conversationId ? { conversationId } : null,
      status: 'open',
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from('audit_log').insert({
    actor_id: session.userId,
    action: 'report.filed',
    target: data.id,
    target_user_id: targetId,
    details: { reason },
  });
  return NextResponse.json({ id: data.id });
}
