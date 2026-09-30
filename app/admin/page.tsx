import { getAdminStats } from '@/lib/admin/stats';
import { supabaseAdmin } from '@/lib/db/client';
import { ReportsQueue } from '@/components/admin/reports-queue';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const stats = await getAdminStats();
  const cards: { label: string; value: number; hint?: string }[] = [
    { label: 'Users', value: stats.users },
    { label: '18+ verified', value: stats.verified },
    { label: 'Paying', value: stats.paying, hint: 'Plus + Premium' },
    { label: 'Open reports', value: stats.openReports },
    { label: 'Messages · 24h', value: stats.messages24h, hint: 'ciphertext only' },
    { label: 'Live statuses', value: stats.activeStatuses },
    { label: 'Push devices', value: stats.pushDevices },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h2 sm:text-h1">Dashboard</h1>
        {!supabaseAdmin && (
          <p className="mt-2 text-[13px] text-warning">Supabase is not configured — numbers below are zero.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="glass rounded-card px-4 py-3.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">{c.label}</p>
            <p className="mt-1 text-[26px] font-semibold tracking-[-0.03em]">{c.value.toLocaleString()}</p>
            {c.hint && <p className="text-[11px] text-fg-4">{c.hint}</p>}
          </div>
        ))}
      </div>

      <ReportsQueue />

      <p className="text-[12px] text-fg-4">
        Every moderation step writes to <code>mod_actions</code> and <code>audit_log</code>. Appeals must be reviewed by a
        different moderator.
      </p>
    </div>
  );
}
