import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { clientIp, rateLimit, tooMany } from '@/lib/api/rate-limit';

export const dynamic = 'force-dynamic';

const ACTION_ID = /^PR-[A-Za-z0-9]{1,24}$/;

const Body = z.object({
  actionId: z.string().trim().regex(ACTION_ID),
  body: z.string().trim().min(10).max(4000),
  email: z.string().trim().email().max(200).optional().or(z.literal('')),
});

/**
 * Appeal intake for moderation actions.
 *
 * Signed-in users may appeal their own action. A user who cannot sign in because an account is
 * suspended/removed may use the action id plus the email associated with that account. Errors are
 * intentionally generic so the public endpoint cannot be used to enumerate moderation actions.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!(await rateLimit(`help-appeal:${ip}`, 8, 3600))) return tooMany();

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter the action ID, an explanation, and a valid account email if required.' }, { status: 400 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Appeals are temporarily unavailable.' }, { status: 503 });
  }

  const { actionId, body, email } = parsed.data;
  const session = await getSession().catch(() => null);

  const { data: action } = await supabaseAdmin
    .from('mod_actions')
    .select('id,user_id,step,reason,rule_ref,created_at')
    .eq('id', actionId)
    .maybeSingle();

  if (!action?.user_id) {
    return NextResponse.json(
      { error: 'We could not verify that appeal. Check the action ID and account information.' },
      { status: 400 },
    );
  }

  let authorized = session?.userId === action.user_id;

  if (!authorized && email) {
    const { data: owner } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', action.user_id)
      .maybeSingle();
    authorized =
      typeof owner?.email === 'string' &&
      owner.email.trim().toLowerCase() === email.trim().toLowerCase();
  }

  if (!authorized) {
    return NextResponse.json(
      { error: 'We could not verify that appeal. Check the action ID and account information.' },
      { status: 400 },
    );
  }

  const { data: existing } = await supabaseAdmin
    .from('appeals')
    .select('action_id,status,created_at')
    .eq('action_id', actionId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      ok: true,
      actionId,
      status: existing.status ?? 'pending',
      createdAt: existing.created_at ?? null,
      existing: true,
    });
  }

  const { data: appeal, error } = await supabaseAdmin
    .from('appeals')
    .insert({
      action_id: actionId,
      body,
      status: 'pending',
    })
    .select('action_id,status,created_at')
    .single();

  if (error || !appeal) {
    console.error('appeal insert failed', error);
    return NextResponse.json({ error: 'Appeals are temporarily unavailable.' }, { status: 503 });
  }

  await supabaseAdmin
    .from('audit_log')
    .insert({
      actor_id: session?.userId ?? null,
      action: 'moderation.appeal_filed',
      target: actionId,
      target_user_id: action.user_id,
      details: { source: session?.userId ? 'authenticated' : 'public_recovery' },
    })
    .then(
      () => undefined,
      () => undefined,
    );

  return NextResponse.json({
    ok: true,
    actionId,
    status: appeal.status ?? 'pending',
    createdAt: appeal.created_at ?? null,
  });
}

export async function GET() {
  const session = await getSession().catch(() => null);
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Appeals are temporarily unavailable.' }, { status: 503 });

  const { data: actions, error } = await supabaseAdmin
    .from('mod_actions')
    .select('id,step,reason,rule_ref,created_at,expires_at')
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: 'Could not load account standing.' }, { status: 503 });

  const ids = (actions ?? []).map((x) => x.id as string);
  let appealRows: { action_id: string; status: string | null; created_at: string | null }[] = [];

  if (ids.length) {
    const { data } = await supabaseAdmin
      .from('appeals')
      .select('action_id,status,created_at')
      .in('action_id', ids);
    appealRows = (data ?? []) as typeof appealRows;
  }

  const appeals = new Map(appealRows.map((a) => [a.action_id, a]));
  return NextResponse.json({
    actions: (actions ?? []).map((action) => ({
      ...action,
      appeal: appeals.get(action.id as string) ?? null,
    })),
  });
}
