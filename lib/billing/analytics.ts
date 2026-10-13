import 'server-only';
import { supabaseAdmin } from '@/lib/db/client';
import type { Plan } from './paypal';

/**
 * Subscription analytics computed from `users` (plan state) and `payments` (what PayPal actually charged).
 * List-price MRR uses the plan prices shown at checkout; realised revenue comes from completed payments.
 */

/** Monthly list price per plan (USD) — matches the PayPal plans described in .env.example / KEYS.md. */
export const PLAN_MONTHLY_USD: Record<Exclude<Plan, 'free'>, number> = { plus: 5, premium: 10 };

export type MonthPoint = { label: string; value: number };

export type RevenueStats = {
  activeByPlan: { plus: number; premium: number };
  mrr: number;
  arr: number;
  arpu: number;
  newSubs30d: number;
  churned30d: number;
  churnRate30d: number;
  paymentFailed: number;
  revenue30d: number;
  revenuePrev30d: number;
  revenueByMonth: MonthPoint[];
  paymentsByMonth: MonthPoint[];
  recentPayments: {
    id: string;
    userId: string | null;
    amount: number;
    currency: string;
    status: string;
    createdAt: string;
    description: string | null;
  }[];
  failedPayments: { id: string; userId: string | null; createdAt: string }[];
};

async function count(table: string, apply: (q: any) => any): Promise<number> {
  if (!supabaseAdmin) return 0;
  const { count: n } = await apply(supabaseAdmin.from(table).select('*', { count: 'exact', head: true }));
  return n ?? 0;
}

async function sumCompleted(fromIso: string, toIso?: string): Promise<number> {
  if (!supabaseAdmin) return 0;
  let q = supabaseAdmin
    .from('payments')
    .select('amount')
    .eq('status', 'COMPLETED')
    .gte('created_at', fromIso);
  if (toIso) q = q.lt('created_at', toIso);
  const { data } = await q.limit(5000);
  return (data ?? []).reduce((a, p) => a + Number(p.amount ?? 0), 0);
}

export async function getRevenueStats(): Promise<RevenueStats> {
  const empty: RevenueStats = {
    activeByPlan: { plus: 0, premium: 0 },
    mrr: 0,
    arr: 0,
    arpu: 0,
    newSubs30d: 0,
    churned30d: 0,
    churnRate30d: 0,
    paymentFailed: 0,
    revenue30d: 0,
    revenuePrev30d: 0,
    revenueByMonth: [],
    paymentsByMonth: [],
    recentPayments: [],
    failedPayments: [],
  };
  if (!supabaseAdmin) return empty;

  const now = Date.now();
  const d30 = new Date(now - 30 * 86400_000).toISOString();
  const d60 = new Date(now - 60 * 86400_000).toISOString();

  const [
    plus,
    premium,
    newSubs30d,
    churned30d,
    paymentFailed,
    revenue30d,
    revenuePrev30d,
    monthly,
    recent,
    failed,
  ] = await Promise.all([
    count('users', (q) => q.eq('plan', 'plus').is('deleted_at', null)),
    count('users', (q) => q.eq('plan', 'premium').is('deleted_at', null)),
    count('analytics_events', (q) => q.eq('event', 'subscribed').gte('created_at', d30)),
    count('users', (q) => q.gte('cancelled_at', d30)),
    count('users', (q) => q.eq('subscription_status', 'PAYMENT_FAILED').is('deleted_at', null)),
    sumCompleted(d30),
    sumCompleted(d60, d30),
    supabaseAdmin.rpc('revenue_monthly', { p_months: 12 }),
    supabaseAdmin
      .from('payments')
      .select('id, user_id, amount, currency, status, created_at, description')
      .order('created_at', { ascending: false })
      .limit(25),
    supabaseAdmin
      .from('payments')
      .select('id, user_id, created_at')
      .eq('status', 'FAILED')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const active = plus + premium;
  const mrr = plus * PLAN_MONTHLY_USD.plus + premium * PLAN_MONTHLY_USD.premium;
  const activeAtStart = active + churned30d - newSubs30d;

  const months = (monthly.data ?? []) as { month: string; revenue: number; payments: number }[];
  const label = (m: string) => new Date(m).toLocaleString('en', { month: 'short', timeZone: 'UTC' });

  return {
    activeByPlan: { plus, premium },
    mrr,
    arr: mrr * 12,
    arpu: active ? mrr / active : 0,
    newSubs30d,
    churned30d,
    churnRate30d: activeAtStart > 0 ? churned30d / activeAtStart : 0,
    paymentFailed,
    revenue30d,
    revenuePrev30d,
    revenueByMonth: months.map((m) => ({ label: label(m.month), value: Number(m.revenue) })),
    paymentsByMonth: months.map((m) => ({ label: label(m.month), value: Number(m.payments) })),
    recentPayments: (recent.data ?? []).map((p) => ({
      id: p.id,
      userId: p.user_id,
      amount: Number(p.amount),
      currency: p.currency ?? 'USD',
      status: p.status,
      createdAt: p.created_at,
      description: p.description,
    })),
    failedPayments: (failed.data ?? []).map((p) => ({
      id: p.id,
      userId: p.user_id,
      createdAt: p.created_at,
    })),
  };
}
