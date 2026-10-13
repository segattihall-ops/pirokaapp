'use client';

import { useCallback, useEffect, useState } from 'react';

type E = {
  id: number;
  fingerprint: string;
  message: string;
  stack: string | null;
  source: string;
  route: string | null;
  severity: string;
  user_id: string | null;
  count: number;
  first_seen: string;
  last_seen: string;
  resolved_at: string | null;
};

export function ErrorsFeed() {
  const [show, setShow] = useState('open');
  const [rows, setRows] = useState<E[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/errors?show=${show}`, { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    setRows(r.ok ? j.errors : []);
  }, [show]);
  useEffect(() => {
    load();
  }, [load]);

  const resolve = async (id: number, resolved: boolean) => {
    await fetch('/api/admin/errors', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, resolved }) });
    load();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5">
        {[
          ['open', 'Open'],
          ['resolved', 'Resolved'],
          ['all', 'All'],
        ].map(([v, l]) => (
          <button key={v} type="button" onClick={() => setShow(v)} className={`chip ${show === v ? 'chip-selected' : ''}`}>
            {l}
          </button>
        ))}
      </div>
      {rows === null ? (
        <p className="py-6 text-center text-fg-3">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-fg-4">No errors. 🎉</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((e) => (
            <li key={e.id} className={`rounded-card border p-3 ${e.resolved_at ? 'border-line-1 bg-white/[0.02] opacity-70' : 'border-line-2 bg-white/5'}`}>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-fg-3">
                <span className={`rounded px-1.5 py-0.5 font-bold uppercase ${e.severity === 'fatal' || e.severity === 'error' ? 'bg-red-900 text-red-200' : 'bg-ink-750 text-fg-2'}`}>{e.severity}</span>
                <span className="rounded bg-ink-750 px-1.5 py-0.5 uppercase">{e.source}</span>
                {e.route && <span className="font-mono">{e.route}</span>}
                <span>· {e.count}× · last {new Date(e.last_seen).toLocaleString()}</span>
                <span className="ml-auto flex gap-1">
                  <button type="button" onClick={() => setOpen(open === e.id ? null : e.id)} className="chip h-7 text-[11px]">
                    {open === e.id ? 'Hide' : 'Stack'}
                  </button>
                  <button type="button" onClick={() => resolve(e.id, !e.resolved_at)} className="chip h-7 text-[11px]">
                    {e.resolved_at ? 'Reopen' : 'Resolve'}
                  </button>
                </span>
              </div>
              <p className="mt-1.5 break-words text-[13px] text-fg">{e.message}</p>
              <p className="text-[11px] text-fg-4">
                fingerprint {e.fingerprint} · first {new Date(e.first_seen).toLocaleString()}
                {e.user_id ? ` · user ${e.user_id.slice(0, 8)}` : ''}
              </p>
              {open === e.id && e.stack && <pre className="mt-2 max-h-[280px] overflow-auto rounded bg-black/40 p-2 text-[11px] text-fg-3">{e.stack}</pre>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
