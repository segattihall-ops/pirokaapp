import Link from 'next/link';
import { supabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

type Row = { id: number; actor_id: string | null; action: string; target: string | null; target_user_id: string | null; details: unknown; created_at: string };

export default async function AuditPage({ searchParams }: { searchParams: { action?: string; actor?: string; target?: string; page?: string } }) {
  const action = (searchParams.action ?? '').trim().slice(0, 60);
  const actor = (searchParams.actor ?? '').trim().slice(0, 40);
  const target = (searchParams.target ?? '').trim().slice(0, 80);
  const page = Math.max(0, Number(searchParams.page ?? 0) || 0);
  const PAGE = 100;

  let rows: Row[] = [];
  if (supabaseAdmin) {
    let q = supabaseAdmin.from('audit_log').select('id, actor_id, action, target, target_user_id, details, created_at').order('id', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (action) q = q.ilike('action', `${action.replace(/[%,]/g, '')}%`);
    if (actor) q = q.eq('actor_id', actor);
    if (target) q = q.or(`target.eq.${target.replace(/[%,]/g, '')},target_user_id.eq.${target.replace(/[%,]/g, '')}`);
    const { data } = await q;
    rows = (data ?? []) as Row[];
  }
  const qs = (p: number) => {
    const u = new URLSearchParams();
    if (action) u.set('action', action);
    if (actor) u.set('actor', actor);
    if (target) u.set('target', target);
    u.set('page', String(p));
    return `/admin/audit?${u}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h2 sm:text-h1">Audit log</h1>
      <form className="flex flex-wrap gap-2" action="/admin/audit">
        <input name="action" defaultValue={action} placeholder="action prefix (mod., billing., paypal.)" className="input h-10 min-w-[220px] flex-1" />
        <input name="actor" defaultValue={actor} placeholder="actor id" className="input h-10 w-[200px] font-mono" />
        <input name="target" defaultValue={target} placeholder="target / user id" className="input h-10 w-[200px] font-mono" />
        <button type="submit" className="btn-secondary h-10 text-[13px]">
          Filter
        </button>
      </form>
      <div className="overflow-x-auto rounded-card border border-line-1">
        <table className="w-full text-[12px]">
          <thead className="bg-ink-900 text-left text-fg-3">
            <tr>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Actor</th>
              <th className="px-3 py-2 font-medium">Target</th>
              <th className="px-3 py-2 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-fg-4">
                  Nothing here.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-line-1 align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-fg-3">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-fg">{r.action}</td>
                  <td className="px-3 py-2 font-mono text-fg-3">
                    {r.actor_id ? <Link href={`/admin/audit?actor=${r.actor_id}`}>{r.actor_id.slice(0, 8)}</Link> : 'system'}
                  </td>
                  <td className="px-3 py-2 font-mono text-fg-3">{(r.target ?? r.target_user_id ?? '—').slice(0, 24)}</td>
                  <td className="max-w-[360px] truncate px-3 py-2 text-fg-3" title={r.details ? JSON.stringify(r.details) : ''}>
                    {r.details ? JSON.stringify(r.details) : ''}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2 text-[13px]">
        {page > 0 && (
          <Link href={qs(page - 1)} className="btn-secondary h-9">
            ‹ Newer
          </Link>
        )}
        {rows.length === PAGE && (
          <Link href={qs(page + 1)} className="btn-secondary h-9">
            Older ›
          </Link>
        )}
      </div>
    </div>
  );
}
