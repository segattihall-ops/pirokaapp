'use client';

import { useCallback, useEffect, useState } from 'react';

type F = {
  id: string;
  handle: string | null;
  email: string | null;
  kind: string;
  message: string;
  path: string | null;
  status: string;
  created_at: string;
};

export function FeedbackInbox() {
  const [filter, setFilter] = useState('new');
  const [rows, setRows] = useState<F[] | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/feedback${filter ? `?status=${filter}` : ''}`, { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    setRows(r.ok ? j.feedback : []);
  }, [filter]);
  useEffect(() => {
    load();
  }, [load]);

  const set = async (id: string, status: string) => {
    await fetch('/api/admin/feedback', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    load();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5">
        {[
          ['new', 'New'],
          ['triaged', 'Triaged'],
          ['closed', 'Closed'],
          ['', 'All'],
        ].map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => setFilter(v)}
            className={`chip ${filter === v ? 'chip-selected' : ''}`}
          >
            {l}
          </button>
        ))}
      </div>
      {rows === null ? (
        <p className="py-6 text-center text-fg-3">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-fg-4">Inbox zero.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((f) => (
            <li key={f.id} className="rounded-card border border-line-2 bg-white/5 p-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-fg-3">
                <span
                  className={`rounded px-1.5 py-0.5 font-bold uppercase ${f.kind === 'bug' ? 'bg-red-900 text-red-200' : 'bg-ink-750 text-fg-2'}`}
                >
                  {f.kind}
                </span>
                <span>{f.handle ? `@${f.handle}` : 'anonymous'}</span>
                {f.email && <span>· {f.email}</span>}
                {f.path && <span>· {f.path}</span>}
                <span>· {new Date(f.created_at).toLocaleString()}</span>
                <span className="ml-auto flex gap-1">
                  {f.status !== 'triaged' && (
                    <button
                      type="button"
                      onClick={() => set(f.id, 'triaged')}
                      className="chip h-7 text-[11px]"
                    >
                      Triage
                    </button>
                  )}
                  {f.status !== 'closed' && (
                    <button
                      type="button"
                      onClick={() => set(f.id, 'closed')}
                      className="chip h-7 text-[11px]"
                    >
                      Close
                    </button>
                  )}
                  {f.status !== 'new' && (
                    <button type="button" onClick={() => set(f.id, 'new')} className="chip h-7 text-[11px]">
                      Reopen
                    </button>
                  )}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-[13px]">{f.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
