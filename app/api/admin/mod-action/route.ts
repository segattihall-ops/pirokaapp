import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireAdmin } from '@/lib/admin/guard';

export const dynamic = 'force-dynamic';

type ModStep = 'warn' | 'limit' | 'suspend' | 'remove';
const STEP_TO_DB: Record<ModStep, 'warning' | 'limited' | 'suspended' | 'removed'> = {
  warn: 'warning',
  limit: 'limited',
  suspend: 'suspended',
  remove: 'removed',
};
const LIMIT_DAYS = 7;

/** Moderation ladder: warning → limited → suspended → removed. Every step is audited. */
export async function POST(request: Request) {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as {
    userId?: string;
    step?: ModStep;
    reason?: string;
    ruleRef?: string;
    reportId?: string;
  };
  const { userId, step, reason, ruleRef = 'community-guidelines', reportId } = body;
  if (!userId || !step || !reason?.trim()) {
    return NextResponse.json({ error: 'userId, step and reason are required' }, { status: 400 });
  }
  if (!(step in STEP_TO_DB)) return NextResponse.json({ error: 'Invalid mod step' }, { status: 400 });
  if (userId === g.session.userId) return NextResponse.json({ error: 'Cannot moderate yourself' }, { status: 400 });

  const dbStep = STEP_TO_DB[step];
  const expiresAt = step === 'limit' ? new Date(Date.now() + LIMIT_DAYS * 86400_000).toISOString() : null;

  const { data: user } = await supabaseAdmin.from('users').select('id').eq('id', userId).maybeSingle();
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const { data: action, error: e1 } = await supabaseAdmin
    .from('mod_actions')
    .insert({ user_id: userId, step: dbStep, reason: reason.trim(), rule_ref: ruleRef, expires_at: expiresAt })
    .select('id')
    .single();
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

  const userPatch: Record<string, unknown> = { mod_step: dbStep };
  if (step === 'remove') {
    userPatch.deleted_at = new Date().toISOString();
    userPatch.visibility = 'hidden';
  } else if (step === 'suspend') {
    userPatch.visibility = 'hidden';
  }
  const { error: e2 } = await supabaseAdmin.from('users').update(userPatch).eq('id', userId);
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  if (reportId) {
    await supabaseAdmin
      .from('reports')
      .update({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: g.session.userId })
      .eq('id', reportId);
  }

  await supabaseAdmin.from('audit_log').insert({
    actor_id: g.session.userId,
    action: `mod.${dbStep}`,
    target: userId,
    target_user_id: userId,
    details: { reason: reason.trim(), ruleRef, reportId: reportId ?? null, actionId: action.id },
  });

  return NextResponse.json({ ok: true, actionId: action.id, step: dbStep, expiresAt });
}
