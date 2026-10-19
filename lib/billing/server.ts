import 'server-only';
import { supabaseAdmin } from '@/lib/db/client';
import { isMissingSchema } from '@/lib/db/schema-errors';
import type { PaidPlan } from './plans';

/**
 * Billing state as the Plans & billing screen shows it (FEATURES §10). Everything here is derived
 * from `users` + `payments`; PayPal is only called when the member acts.
 */
export type BillingStatus = {
  configured: boolean;
  schemaPending: boolean;
  plan: 'free' | 'plus' | 'premium' | 'anonymous';
  status: string | null;
  subscriptionId: string | null;
  renewsAt: string | null;
  cancelAt: string | null;
  pausedUntil: string | null;
  comp: { plan: PaidPlan; until: string } | null;
  payerEmail: string | null;
  billingEmail: string | null;
  paymentFailedAt: string | null;
};

const BILLING_COLUMNS =
  'plan, subscription_status, paypal_subscription_id, renews_at, cancel_at, paused_until, comp_plan, comp_until, paypal_payer_email, billing_email, payment_failed_at, email';

export async function billingStatus(userId: string, configured: boolean): Promise<BillingStatus> {
  const empty: BillingStatus = {
    configured,
    schemaPending: false,
    plan: 'free',
    status: null,
    subscriptionId: null,
    renewsAt: null,
    cancelAt: null,
    pausedUntil: null,
    comp: null,
    payerEmail: null,
    billingEmail: null,
    paymentFailedAt: null,
  };
  if (!supabaseAdmin) return empty;
  let { data, error } = await supabaseAdmin.from('users').select(BILLING_COLUMNS).eq('id', userId).maybeSingle();
  if (error && isMissingSchema(error)) {
    // Migration 041 not applied yet: fall back to the columns that exist.
    const r = await supabaseAdmin
      .from('users')
      .select('plan, subscription_status, paypal_subscription_id, payment_failed_at, email')
      .eq('id', userId)
      .maybeSingle();
    data = r.data as typeof data;
    error = r.error;
    return {
      ...empty,
      schemaPending: true,
      plan: (data?.plan as BillingStatus['plan']) ?? 'free',
      status: data?.subscription_status ?? null,
      subscriptionId: data?.paypal_subscription_id ?? null,
      paymentFailedAt: data?.payment_failed_at ?? null,
    };
  }
  if (!data) return empty;
  const d = data as Record<string, any>;
  const compActive = d.comp_plan && d.comp_until && new Date(d.comp_until).getTime() > Date.now();
  return {
    configured,
    schemaPending: false,
    plan: d.plan ?? 'free',
    status: d.subscription_status ?? null,
    subscriptionId: d.paypal_subscription_id ?? null,
    renewsAt: d.renews_at ?? null,
    cancelAt: d.cancel_at ?? null,
    pausedUntil: d.paused_until ?? null,
    comp: compActive ? { plan: d.comp_plan, until: d.comp_until } : null,
    payerEmail: d.paypal_payer_email ?? null,
    billingEmail: d.billing_email ?? d.email ?? null,
    paymentFailedAt: d.payment_failed_at ?? null,
  };
}

export async function nextReceiptNo(): Promise<string> {
  if (!supabaseAdmin) return `INV-${Date.now()}`;
  const { data } = await supabaseAdmin.rpc('next_receipt_no');
  return typeof data === 'string' && data ? data : `INV-${Date.now()}`;
}

export type Receipt = {
  id: string;
  receiptNo: string;
  date: string;
  plan: string;
  amount: number;
  currency: string;
  status: string;
  kind: 'payment' | 'promo';
};

/** Payments (PayPal sales) plus promo/invite redemptions ($0), newest first. */
export async function listReceipts(userId: string): Promise<{ receipts: Receipt[]; schemaPending: boolean }> {
  if (!supabaseAdmin) return { receipts: [], schemaPending: false };
  const [{ data: pays, error: e1 }, { data: promos, error: e2 }] = await Promise.all([
    supabaseAdmin
      .from('payments')
      .select('id, payment_id, receipt_no, amount, currency, status, plan, description, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(36),
    supabaseAdmin
      .from('promo_redemptions')
      .select('id, code, kind, plan, months, redeemed_at')
      .eq('user_id', userId)
      .order('redeemed_at', { ascending: false })
      .limit(12),
  ]);
  const schemaPending = Boolean((e1 && isMissingSchema(e1)) || (e2 && isMissingSchema(e2)));
  const receipts: Receipt[] = [
    ...((pays ?? []) as any[]).map((p) => ({
      id: String(p.id),
      receiptNo: p.receipt_no ?? `PP-${String(p.payment_id).slice(-8).toUpperCase()}`,
      date: p.created_at,
      plan: p.plan ?? (p.description === 'Subscription payment failed' ? 'Payment attempt' : 'Subscription'),
      amount: Number(p.amount ?? 0),
      currency: p.currency ?? 'USD',
      status: p.status === 'COMPLETED' ? 'Paid' : p.status === 'FAILED' ? 'Declined' : String(p.status),
      kind: 'payment' as const,
    })),
    ...((promos ?? []) as any[]).map((r) => ({
      id: `promo-${r.id}`,
      receiptNo: `PROMO-${String(r.id).padStart(5, '0')}`,
      date: r.redeemed_at,
      plan: `${r.plan === 'premium' ? 'Premium' : 'Plus'} · ${r.kind === 'invite' ? 'invite' : 'promo'} ${r.code}`,
      amount: 0,
      currency: 'USD',
      status: 'Redeemed',
      kind: 'promo' as const,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return { receipts, schemaPending };
}

/** Grants a complimentary month (promo or invite). Paid members keep their plan; the comp just extends. */
export async function grantComp(userId: string, plan: PaidPlan, months: number) {
  if (!supabaseAdmin) return;
  const { data: u } = await supabaseAdmin
    .from('users')
    .select('plan, comp_plan, comp_until, subscription_status')
    .eq('id', userId)
    .maybeSingle();
  const base =
    u?.comp_until && new Date(u.comp_until).getTime() > Date.now() ? new Date(u.comp_until) : new Date();
  const until = new Date(base.getTime() + months * 30 * 86400_000).toISOString();
  const paidActive = u?.subscription_status === 'ACTIVE' && (u.plan === 'plus' || u.plan === 'premium');
  const patch: Record<string, unknown> = { comp_plan: plan, comp_until: until };
  if (!paidActive) {
    // Free (or lapsed) member: the comp becomes the live plan until it expires.
    patch.plan = plan;
    patch.subscription_status = 'COMP';
  }
  await supabaseAdmin.from('users').update(patch).eq('id', userId);
  return until;
}

/**
 * Daily sweep (called from /api/cron/lifecycle): cancelled plans end at `cancel_at`, complimentary
 * months end at `comp_until`, paused subscriptions resume at `paused_until`.
 */
export async function runBillingLifecycle(
  activate: (subscriptionId: string) => Promise<void>,
): Promise<Record<string, number>> {
  if (!supabaseAdmin) return {};
  const now = new Date().toISOString();
  const out: Record<string, number> = { billing_cancel_ended: 0, billing_comp_ended: 0, billing_resumed: 0 };

  const { data: ended, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .lte('cancel_at', now)
    .in('plan', ['plus', 'premium'])
    .limit(500);
  if (error) {
    if (isMissingSchema(error)) return out;
    throw error;
  }
  for (const u of ended ?? []) {
    await supabaseAdmin
      .from('users')
      .update({ plan: 'free', cancel_at: null, renews_at: null, subscription_status: 'CANCELLED' })
      .eq('id', u.id);
    out.billing_cancel_ended += 1;
  }

  const { data: comps } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('subscription_status', 'COMP')
    .lte('comp_until', now)
    .limit(500);
  for (const u of comps ?? []) {
    await supabaseAdmin
      .from('users')
      .update({ plan: 'free', comp_plan: null, comp_until: null, subscription_status: 'INACTIVE' })
      .eq('id', u.id);
    out.billing_comp_ended += 1;
  }

  const { data: paused } = await supabaseAdmin
    .from('users')
    .select('id, paypal_subscription_id')
    .lte('paused_until', now)
    .not('paypal_subscription_id', 'is', null)
    .limit(200);
  for (const u of paused ?? []) {
    try {
      await activate(u.paypal_subscription_id as string);
      await supabaseAdmin
        .from('users')
        .update({ paused_until: null, subscription_status: 'ACTIVE' })
        .eq('id', u.id);
      out.billing_resumed += 1;
    } catch (e) {
      console.error('resume after pause failed', u.id, e);
    }
  }
  return out;
}
