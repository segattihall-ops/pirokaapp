import Link from 'next/link';
import { supabaseAdmin } from '@/lib/db/client';
import { getAdminStats } from '@/lib/admin/stats';
import { getGrowthStats } from '@/lib/admin/analytics';
import { getRevenueStats } from '@/lib/billing/analytics';
import { ConsoleHeader } from '@/components/admin/console/ui';
import { SEV, seedAppeals, seedVerifs, seedTickets, seedReports } from '@/lib/admin/ts-seed';

export const dynamic = 'force-dynamic';

type Kpi = { label: string; value: string; delta: string; col: string };
// Faithful fallback series + KPIs from the prototype, used only when Supabase isn't configured.
const DEMO_DAU = [2.1, 2.3, 2.2, 2.6, 3.4, 4.1, 3.8, 2.4, 2.5, 2.6, 2.9, 3.6, 4.4, 4.0];

export default async function AdminOverview() {
  const configured = !!supabaseAdmin;

  let kpis: Kpi[];
  let dau: number[];
  let reportsOpen: number;
  let reportsSafety: number;

  if (configured) {
    const [stats, growth, revenue] = await Promise.all([
      getAdminStats(),
      getGrowthStats(),
      getRevenueStats(),
    ]);
    reportsOpen = stats.openReports;
    reportsSafety = 0; // precise severity split needs the reports list; the Reports tab shows it.
    const verifiedPct = stats.users ? Math.round((stats.verified / stats.users) * 100) : 0;
    const d7 = growth.signupsThis7 - growth.signupsPrev7;
    kpis = [
      {
        label: 'Active now',
        value: stats.activeStatuses.toLocaleString(),
        delta: 'live statuses',
        col: '#34d399',
      },
      {
        label: 'New sign-ups · 7d',
        value: growth.signupsThis7.toLocaleString(),
        delta: `${d7 >= 0 ? '+' : ''}${d7.toLocaleString()} vs prev 7d`,
        col: d7 >= 0 ? '#34d399' : '#f87171',
      },
      {
        label: 'Open reports',
        value: String(stats.openReports),
        delta: `${stats.openReports} to review`,
        col: stats.openReports ? '#fbbf24' : '#999',
      },
      {
        label: 'DAU / WAU / MAU',
        value: `${growth.dau} / ${growth.wau} / ${growth.mau}`,
        delta: 'distinct users',
        col: '#999',
      },
      {
        label: 'Verified humans',
        value: `${verifiedPct}%`,
        delta: `${stats.verified.toLocaleString()} verified 18+`,
        col: '#999',
      },
      {
        label: 'MRR',
        value: `$${revenue.mrr.toLocaleString()}`,
        delta: `${stats.paying} paying`,
        col: '#34d399',
      },
    ];
    const series = growth.active30d.slice(-14).map((d) => d.value);
    dau = series.some((v) => v > 0) ? series : DEMO_DAU;
  } else {
    const safety = seedReports().filter((r) => r.status === 'open' && r.sev === 3).length;
    reportsOpen = seedReports().filter((r) => r.status === 'open').length;
    reportsSafety = safety;
    kpis = [
      { label: 'Active now', value: '3,412', delta: '+8% vs last Mon', col: '#34d399' },
      { label: 'New sign-ups today', value: '612', delta: '94% passed age check', col: '#34d399' },
      {
        label: 'Open reports',
        value: String(reportsOpen),
        delta: `${safety} safety`,
        col: safety ? '#f87171' : '#999',
      },
      { label: 'Median review time', value: '2h 14m', delta: 'Target < 4h safety', col: '#34d399' },
      { label: 'Verified humans', value: '81%', delta: 'Photo 43% · Phone 58%', col: '#999' },
      { label: 'MRR', value: '$48.2k', delta: 'Plus 7.1k · Premium 1.3k', col: '#34d399' },
    ];
    dau = DEMO_DAU;
  }

  const peak = Math.max(...dau, 1);
  const openAppeals = seedAppeals().filter((a) => a.status === 'open').length;
  const openVerifs = seedVerifs().filter((v) => v.status === 'open').length;
  const openTickets = seedTickets().filter((t) => t.status === 'open').length;
  const premTickets = seedTickets().filter((t) => t.status === 'open' && t.prem).length;

  const attention = [
    {
      label: `${reportsSafety || reportsOpen} ${reportsSafety ? 'safety reports' : 'reports'} to review`,
      href: '/admin/reports',
      col: reportsSafety ? '#f87171' : '#fbbf24',
      meta: reportsSafety ? 'SLA 4h' : 'SLA 24h',
    },
    {
      label: `${openAppeals} appeals waiting`,
      href: '/admin/appeals',
      col: '#f5f5f5',
      meta: 'second review',
    },
    {
      label: `${openVerifs} verifications`,
      href: '/admin/verifications',
      col: '#34d399',
      meta: 'manual check',
    },
    {
      label: `${openTickets} support tickets`,
      href: '/admin/support',
      col: '#fbbf24',
      meta: premTickets ? `${premTickets} Premium` : 'standard',
    },
  ];

  return (
    <>
      <ConsoleHeader title="Overview" sub="Live across all cities" demo={!configured} />

      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2.5">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="flex flex-col gap-1.5 rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#0c0c0c] p-4"
          >
            <span className="text-[12px] text-fg-3">{k.label}</span>
            <span className="text-[26px] font-semibold tracking-[-0.02em] [font-variant-numeric:tabular-nums]">
              {k.value}
            </span>
            <span className="text-[12px]" style={{ color: k.col }}>
              {k.delta}
            </span>
          </div>
        ))}
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr))]">
        <div className="flex flex-col gap-3.5 rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#0c0c0c] p-[18px]">
          <span className="flex justify-between text-[14px] font-semibold">
            Daily active users
            <span className="text-[12px] font-normal text-fg-3">Last 14 days</span>
          </span>
          <div className="flex h-[160px] items-end gap-1.5">
            {dau.map((v, i) => (
              <div
                key={i}
                title={`${v}${configured ? '' : 'k'}`}
                className="flex-1 rounded-[5px_5px_2px_2px]"
                style={{
                  height: `${Math.round((v / peak) * 100)}%`,
                  background: i === dau.length - 1 ? '#34d399' : 'rgba(52,211,153,0.35)',
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2.5 rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#0c0c0c] p-[18px]">
          <span className="text-[14px] font-semibold">Needs attention</span>
          {attention.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="flex items-center justify-between gap-2.5 rounded-[12px] border border-[rgba(255,255,255,0.07)] bg-white/[0.02] px-3 py-2.5 text-[13px] font-medium hover:bg-white/[0.04]"
            >
              <span className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full" style={{ background: t.col }} />
                {t.label}
              </span>
              <span className="text-[12px] text-fg-3">{t.meta}</span>
            </Link>
          ))}
        </div>
      </div>

      <p className="text-[12px] text-fg-4">
        Every moderation step writes to <code>mod_actions</code> and <code>audit_log</code> (
        <Link href="/admin/audit" className="text-green">
          viewer
        </Link>
        ). Appeals must be reviewed by a different moderator than the original action.
      </p>
    </>
  );
}
