import { getRevenueStats, PLAN_MONTHLY_USD } from '@/lib/billing/analytics';
import { Bars, CHART_COLORS, Legend, StatCard } from '@/components/admin/charts';

export const dynamic = 'force-dynamic';

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default async function RevenuePage() {
  const r = await getRevenueStats();
  const active = r.activeByPlan.plus + r.activeByPlan.premium;
  const mix = [
    { label: 'Plus', color: CHART_COLORS.green, value: r.activeByPlan.plus },
    { label: 'Premium', color: CHART_COLORS.indigo, value: r.activeByPlan.premium },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h2 sm:text-h1">Revenue</h1>
        <p className="mt-1 text-[12px] text-fg-4">
          MRR uses list prices (Plus ${PLAN_MONTHLY_USD.plus}, Premium ${PLAN_MONTHLY_USD.premium}); revenue uses completed PayPal payments.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="MRR" value={money(r.mrr)} hint={`ARR ${money(r.arr)}`} />
        <StatCard label="Active subscriptions" value={active} hint={`ARPU ${money(r.arpu)}`} />
        <StatCard label="Revenue · 30d" value={money(r.revenue30d)} delta={Math.round(r.revenue30d - r.revenuePrev30d)} />
        <StatCard label="Churn · 30d" value={`${(r.churnRate30d * 100).toFixed(1)}%`} hint={`${r.churned30d} cancelled · ${r.newSubs30d} new`} />
        <StatCard label="Payment failed" value={r.paymentFailed} hint="accounts in dunning" />
      </div>

      <div className="glass rounded-card px-4 py-3.5">
        <p className="text-[13px] font-semibold">Plan mix</p>
        <div className="mt-2 flex h-4 overflow-hidden rounded bg-white/[0.05]" role="img" aria-label={`Plus ${r.activeByPlan.plus}, Premium ${r.activeByPlan.premium}`}>
          {mix.map((m) => (
            <span key={m.label} title={`${m.label}: ${m.value}`} style={{ width: `${active ? (m.value / active) * 100 : 0}%`, background: m.color, marginRight: 2 }} />
          ))}
        </div>
        <div className="mt-2">
          <Legend items={mix.map((m) => ({ ...m, value: `${m.value} (${active ? Math.round((m.value / active) * 100) : 0}%)` }))} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bars title="Revenue by month (USD)" data={r.revenueByMonth} format={(n) => money(n)} />
        <Bars title="Completed payments by month" data={r.paymentsByMonth} color={CHART_COLORS.indigo} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-card px-4 py-3.5">
          <p className="text-[13px] font-semibold">Recent payments</p>
          {r.recentPayments.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-fg-4">No payments yet.</p>
          ) : (
            <table className="mt-2 w-full text-[12px]">
              <thead className="text-left text-fg-3">
                <tr>
                  <th className="py-1 font-medium">When</th>
                  <th className="py-1 font-medium">User</th>
                  <th className="py-1 text-right font-medium">Amount</th>
                  <th className="py-1 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {r.recentPayments.map((p) => (
                  <tr key={p.id} className="border-t border-line-1">
                    <td className="py-1.5 text-fg-3">{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td className="py-1.5 font-mono text-fg-2">{p.userId?.slice(0, 8) ?? '—'}</td>
                    <td className="py-1.5 text-right">
                      {p.currency} {p.amount.toFixed(2)}
                    </td>
                    <td className={`py-1.5 text-right ${p.status === 'COMPLETED' ? 'text-green' : 'text-danger'}`}>{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="glass rounded-card px-4 py-3.5">
          <p className="text-[13px] font-semibold">Failed payments</p>
          {r.failedPayments.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-fg-4">None. 🎉</p>
          ) : (
            <ul className="mt-2 space-y-1 text-[12px] text-fg-3">
              {r.failedPayments.map((p) => (
                <li key={p.id}>
                  {new Date(p.createdAt).toLocaleString()} · user <span className="font-mono text-fg-2">{p.userId?.slice(0, 8) ?? '—'}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-fg-4">Dunning emails go out automatically on day 0, 3 and 7 (lifecycle cron).</p>
        </div>
      </div>
    </div>
  );
}
