import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/api/guard';
import { supabaseAdmin } from '@/lib/db/client';
import { ensureUserRow } from '@/lib/db/users';
import { grantComp } from '@/lib/billing/server';
import { isMissingSchema, schemaPendingResponse } from '@/lib/db/schema-errors';
import { withApi } from '@/lib/errors/server';
import { track } from '@/lib/analytics/server';
import type { PaidPlan } from '@/lib/billing/plans';

export const dynamic = 'force-dynamic';

const Body = z.object({ code: z.string().trim().toUpperCase().min(4).max(24) });
const INVALID = "That code isn't valid or has expired.";

/**
 * Redeem a campaign code (promo_codes, e.g. PRIDE26) or a friend's invite code (PIROKA-<code> from
 * referral_codes). Both grant one month of Plus; an invite also gives the inviter a month.
 */
export const POST = withApi('/api/billing/promo', async (request: Request) => {
  const g = await requireUser();
  if (g.error) return g.error;
  const me = g.session.userId;
  const db = supabaseAdmin!;
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: INVALID }, { status: 400 });
  const code = parsed.data.code;
  await ensureUserRow(g.session);

  const { data: already, error: e0 } = await db
    .from('promo_redemptions')
    .select('id')
    .eq('user_id', me)
    .eq('code', code)
    .maybeSingle();
  if (e0 && isMissingSchema(e0)) return NextResponse.json(schemaPendingResponse('041_billing_v2'), { status: 503 });
  if (already) return NextResponse.json({ error: 'You already used this code.' }, { status: 409 });

  const now = new Date().toISOString();
  let plan: PaidPlan = 'plus';
  let months = 1;
  let kind: 'promo' | 'invite' = 'promo';
  let inviterId: string | null = null;

  if (code.startsWith('PIROKA-')) {
    const raw = code.slice('PIROKA-'.length);
    const { data: ref } = await db
      .from('referral_codes')
      .select('id, user_id, max_uses, used_count, active, expires_at')
      .eq('code', raw)
      .maybeSingle();
    if (
      !ref ||
      !ref.active ||
      ref.user_id === me ||
      (ref.expires_at && ref.expires_at < now) ||
      (ref.max_uses != null && ref.used_count >= ref.max_uses)
    )
      return NextResponse.json({ error: INVALID }, { status: 404 });
    kind = 'invite';
    inviterId = ref.user_id;
    await db.from('referral_codes').update({ used_count: ref.used_count + 1 }).eq('id', ref.id);
    await db
      .from('referral_signups')
      .insert({ referrer_id: ref.user_id, new_user_id: me, referral_code_id: ref.id, reward_credited: true, credited_at: now })
      .then(() => undefined, () => undefined);
  } else {
    const { data: promo } = await db.from('promo_codes').select('*').eq('code', code).maybeSingle();
    if (
      !promo ||
      !promo.active ||
      (promo.expires_at && promo.expires_at < now) ||
      (promo.max_uses != null && promo.used_count >= promo.max_uses)
    )
      return NextResponse.json({ error: INVALID }, { status: 404 });
    plan = promo.plan;
    months = promo.months;
    await db.from('promo_codes').update({ used_count: promo.used_count + 1 }).eq('code', code);
  }

  const until = await grantComp(me, plan, months);
  if (inviterId) await grantComp(inviterId, 'plus', 1);
  await db.from('promo_redemptions').insert({ user_id: me, code, kind, plan, months });
  await db.from('audit_log').insert({ actor_id: me, action: 'billing.promo', target: code, details: { kind, plan, months } });
  void track({ userId: me, event: 'promo_redeemed', props: { kind, plan, months } });

  const label = `${months} month${months > 1 ? 's' : ''} of ${plan === 'premium' ? 'Premium' : 'Plus'}`;
  return NextResponse.json({
    ok: true,
    message: kind === 'invite' ? `Invite accepted: ${label}. Your friend gets a month too.` : `Code applied: ${label}.`,
    until,
  });
});
