import 'server-only';
import { supabaseAdmin } from '@/lib/db/client';
import { alreadySent, sendEmail } from '@/lib/email';
import { templates } from '@/lib/email/templates';
import { unsubscribeUrl } from '@/lib/email/unsubscribe';

/**
 * Daily lifecycle sweep (cron). Each step picks a small batch, skips anyone already mailed that
 * template, and respects marketing opt-out through `sendEmail`. Dunning mail is transactional.
 *
 *  - reengage_7 / reengage_30: inactive for 7 / 30 days (last_seen_at, or created_at if never seen)
 *  - winback: cancelled 3–10 days ago, still on free
 *  - dunning_3 / dunning_7: payment_failed_at 3 / 7 days ago, still PAYMENT_FAILED; day 7 also downgrades
 */

type Row = { id: string; email: string; handle: string | null };
const BATCH = 200;
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400_000).toISOString();

async function sendTo(
  rows: Row[],
  template: string,
  build: (r: Row) => ReturnType<typeof templates.cancelled>,
  marketing: boolean,
) {
  let n = 0;
  for (const r of rows) {
    if (await alreadySent(r.id, template)) continue;
    const res = await sendEmail({
      to: r.email,
      userId: r.id,
      template,
      marketing,
      unsubscribeUrl: marketing ? unsubscribeUrl(r.id) : undefined,
      ...build(r),
    });
    if (res.ok) n += 1;
  }
  return n;
}

async function inactive(days: number): Promise<Row[]> {
  if (!supabaseAdmin) return [];
  // "Never seen" accounts fall back to created_at; two queries keep the OR simple for PostgREST.
  const [{ data: a }, { data: b }] = await Promise.all([
    supabaseAdmin
      .from('users')
      .select('id, email, handle')
      .not('email', 'is', null)
      .is('deleted_at', null)
      .eq('marketing_opt_out', false)
      .lt('last_seen_at', iso(days))
      .limit(BATCH),
    supabaseAdmin
      .from('users')
      .select('id, email, handle')
      .not('email', 'is', null)
      .is('deleted_at', null)
      .eq('marketing_opt_out', false)
      .is('last_seen_at', null)
      .lt('created_at', iso(days))
      .limit(BATCH),
  ]);
  const seen = new Set<string>();
  return [...(a ?? []), ...(b ?? [])].filter((r) => r.email && !seen.has(r.id) && seen.add(r.id)) as Row[];
}

export async function runLifecycle(): Promise<Record<string, number>> {
  const out: Record<string, number> = {
    reengage_7: 0,
    reengage_30: 0,
    winback: 0,
    dunning_3: 0,
    dunning_7: 0,
    downgraded: 0,
  };
  if (!supabaseAdmin) return out;
  const db = supabaseAdmin;

  out.reengage_7 = await sendTo(
    await inactive(7),
    'reengage_7',
    (r) => templates.reengage(7, r.handle, unsubscribeUrl(r.id)),
    true,
  );
  out.reengage_30 = await sendTo(
    await inactive(30),
    'reengage_30',
    (r) => templates.reengage(30, r.handle, unsubscribeUrl(r.id)),
    true,
  );

  const { data: cancelled } = await db
    .from('users')
    .select('id, email, handle')
    .not('email', 'is', null)
    .is('deleted_at', null)
    .eq('plan', 'free')
    .gte('cancelled_at', iso(10))
    .lte('cancelled_at', iso(3))
    .limit(BATCH);
  out.winback = await sendTo(
    ((cancelled ?? []) as Row[]).filter((r) => r.email),
    'winback',
    (r) => templates.winback(unsubscribeUrl(r.id)),
    true,
  );

  const failing = (days: number) =>
    db
      .from('users')
      .select('id, email, handle')
      .not('email', 'is', null)
      .is('deleted_at', null)
      .eq('subscription_status', 'PAYMENT_FAILED')
      .lte('payment_failed_at', iso(days))
      .limit(BATCH);
  const { data: d3 } = await failing(3);
  out.dunning_3 = await sendTo(
    ((d3 ?? []) as Row[]).filter((r) => r.email),
    'dunning_3',
    () => templates.paymentFailed(3),
    false,
  );

  const { data: d7 } = await failing(7);
  out.dunning_7 = await sendTo(
    ((d7 ?? []) as Row[]).filter((r) => r.email),
    'dunning_7',
    () => templates.paymentFailed(7),
    false,
  );
  // After a week of failed retries the plan drops to free; PayPal will suspend the agreement on its side.
  const { data: d8 } = await db
    .from('users')
    .select('id')
    .eq('subscription_status', 'PAYMENT_FAILED')
    .lte('payment_failed_at', iso(8))
    .limit(BATCH);
  for (const u of d8 ?? []) {
    await db
      .from('users')
      .update({ plan: 'free', subscription_status: 'LAPSED', cancelled_at: new Date().toISOString() })
      .eq('id', u.id);
    await db
      .from('audit_log')
      .insert({
        actor_id: null,
        action: 'billing.lapsed',
        target: u.id,
        target_user_id: u.id,
        details: { reason: 'payment failed 8+ days' },
      });
    out.downgraded += 1;
  }
  return out;
}
