import Link from 'next/link';
import { getAdminStats } from '@/lib/admin/stats';
import { getGrowthStats } from '@/lib/admin/analytics';
import { getRevenueStats } from '@/lib/billing/analytics';
import { supabaseAdmin } from '@/lib/db/client';
import { ReportsQueue } from '@/components/admin/reports-queue';
import { Bars, Funnel, StatCard } from '@/components/admin/charts';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const [stats, growth, revenue, errors] = await Promise.all([
    getAdminStats(),
    getGrowthStats(),
    getRevenueStats(),
    supabaseAdmin
      ? supabaseAdmin
          .from('error_events')
          .select('id', { count: 'exact', head: true })
          .is('resolved_at', null)
          .gte('last_seen', new Date(Date.now() - 86400_000).toISOString())
      : Promise.resolve({ count: 0 }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h2 sm:text-h1">Overview</h1>
        {!supabaseAdmin && (
          <p className="mt-2 text-[13px] text-warning">
            Supabase is not configured — numbers below are zero.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard
          label="Users"
          value={stats.users}
          hint={`${stats.verified.toLocaleString()} verified 18+`}
        />
        <StatCard
          label="Signups · 7d"
          value={growth.signupsThis7}
          delta={growth.signupsThis7 - growth.signupsPrev7}
        />
        <StatCard
          label="DAU / WAU / MAU"
          value={`${growth.dau} / ${growth.wau} / ${growth.mau}`}
          hint="distinct users with events"
        />
        <StatCard label="MRR" value={`$${revenue.mrr.toLocaleString()}`} hint={`${stats.paying} paying`} />
        <StatCard label="Open reports" value={stats.openReports} />
        <StatCard label="Errors · 24h" value={errors.count ?? 0} hint="unresolved" />
        <StatCard label="Live statuses" value={stats.activeStatuses} />
        <StatCard label="Messages · 24h" value={stats.messages24h} hint="ciphertext only" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bars title="Signups · last 30 days" data={growth.signups30d} />
        <Bars title="Active users · last 30 days" data={growth.active30d} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Funnel title="Activation funnel · 30 days (distinct users)" stages={growth.funnel} />
        <div className="glass rounded-card px-4 py-3.5">
          <p className="text-[13px] font-semibold">Top events · 30 days</p>
          {growth.topEvents.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-fg-4">No events yet.</p>
          ) : (
            <table className="mt-2 w-full text-[12px]">
              <thead className="text-left text-fg-3">
                <tr>
                  <th className="py-1 font-medium">Event</th>
                  <th className="py-1 text-right font-medium">Count</th>
                  <th className="py-1 text-right font-medium">Users</th>
                </tr>
              </thead>
              <tbody>
                {growth.topEvents.map((e) => (
                  <tr key={e.event} className="border-t border-line-1">
                    <td className="py-1.5 font-mono text-fg-2">{e.event}</td>
                    <td className="py-1.5 text-right">{e.n.toLocaleString()}</td>
                    <td className="py-1.5 text-right text-fg-3">{e.users.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ReportsQueue />

      <p className="text-[12px] text-fg-4">
        Every moderation step writes to <code>mod_actions</code> and <code>audit_log</code> (
        <Link href="/admin/audit" className="text-green">
          viewer
        </Link>
        ). Appeals must be reviewed by a different moderator.
      </p>
    </div>
  );
}
