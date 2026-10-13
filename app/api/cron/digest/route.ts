import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { getAdminStats } from '@/lib/admin/stats';
import { getGrowthStats } from '@/lib/admin/analytics';
import { getRevenueStats } from '@/lib/billing/analytics';
import { sendEmail } from '@/lib/email';
import { templates } from '@/lib/email/templates';
import { withApi } from '@/lib/errors/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Weekly digest to ADMIN_EMAILS. `Authorization: Bearer $CRON_SECRET`. */
export const GET = withApi('/api/cron/digest', async (request: Request) => {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization') ?? '';
  if (!secret || auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admins = (process.env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (admins.length === 0) return NextResponse.json({ ok: false, reason: 'ADMIN_EMAILS empty' });

  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  const [stats, growth, revenue, errors, feedback, reports] = await Promise.all([
    getAdminStats(),
    getGrowthStats(),
    getRevenueStats(),
    supabaseAdmin ? supabaseAdmin.from('error_events').select('id', { count: 'exact', head: true }).gte('last_seen', weekAgo) : Promise.resolve({ count: 0 }),
    supabaseAdmin ? supabaseAdmin.from('feedback').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo) : Promise.resolve({ count: 0 }),
    supabaseAdmin ? supabaseAdmin.from('reports').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo) : Promise.resolve({ count: 0 }),
  ]);

  const lines = [
    `Users: ${stats.users.toLocaleString()} (${stats.verified.toLocaleString()} verified)`,
    `Signups this week: ${growth.signupsThis7} (prior week ${growth.signupsPrev7})`,
    `Active: ${growth.dau} daily · ${growth.wau} weekly · ${growth.mau} monthly`,
    `MRR: $${revenue.mrr.toLocaleString()} · ${revenue.activeByPlan.plus} Plus · ${revenue.activeByPlan.premium} Premium`,
    `Revenue last 30 days: $${revenue.revenue30d.toFixed(2)} · churn ${(revenue.churnRate30d * 100).toFixed(1)}% · ${revenue.paymentFailed} in dunning`,
    `Reports filed this week: ${reports.count ?? 0} · open now: ${stats.openReports}`,
    `Errors seen this week: ${errors.count ?? 0}`,
    `Feedback received: ${feedback.count ?? 0}`,
  ];
  const content = templates.adminDigest(lines);
  const results = await Promise.all(admins.map((to) => sendEmail({ to, template: 'admin_digest', ...content })));
  return NextResponse.json({ ok: true, sent: results.filter((r) => r.ok).length, lines });
});
