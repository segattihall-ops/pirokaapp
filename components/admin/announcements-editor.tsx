'use client';

import { useCallback, useEffect, useState } from 'react';

type A = { id: string; title: string; body: string; url: string | null; audience: string; starts_at: string; ends_at: string | null };

export function AnnouncementsEditor() {
  const [rows, setRows] = useState<A[] | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [audience, setAudience] = useState('all');
  const [endsAt, setEndsAt] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/announcements', { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    setRows(r.ok ? j.announcements : []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    const r = await fetch('/api/admin/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, url: url || null, audience, endsAt: endsAt ? new Date(endsAt).toISOString() : null }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setMsg(j.error ?? 'Could not publish');
    setTitle('');
    setBody('');
    setUrl('');
    setEndsAt('');
    setMsg('Published. Users see it on their next page load.');
    load();
  };
  const remove = async (id: string) => {
    if (!confirm('Remove this announcement?')) return;
    await fetch(`/api/admin/announcements?id=${id}`, { method: 'DELETE' });
    load();
  };

  const live = (a: A) => new Date(a.starts_at) <= new Date() && (!a.ends_at || new Date(a.ends_at) > new Date());

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form onSubmit={create} className="flex flex-col gap-3 rounded-card border border-line-2 bg-white/[0.04] p-4">
        <p className="text-[13px] font-semibold">New announcement</p>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="input h-10" maxLength={120} required />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="One or two sentences" rows={3} className="input resize-none" maxLength={600} required />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link (optional, /help/… or https://…)" className="input h-10" />
        <div className="flex flex-wrap gap-2">
          <select value={audience} onChange={(e) => setAudience(e.target.value)} className="input h-10 py-0" aria-label="Audience">
            <option value="all">Everyone</option>
            <option value="free">Free plan only</option>
            <option value="paid">Plus + Premium only</option>
          </select>
          <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="input h-10 w-auto" aria-label="Ends at (optional)" />
          <button type="submit" className="btn-primary h-10 text-[13px]">
            Publish
          </button>
        </div>
        {msg && (
          <p role="status" className="text-[12px] text-fg-2">
            {msg}
          </p>
        )}
      </form>

      <div className="space-y-2">
        {rows === null ? (
          <p className="py-6 text-center text-fg-3">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-[12px] text-fg-4">Nothing published yet.</p>
        ) : (
          rows.map((a) => (
            <div key={a.id} className="rounded-card border border-line-2 bg-white/5 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold">{a.title}</p>
                  <p className="text-[12px] text-fg-3">{a.body}</p>
                  <p className="text-[11px] text-fg-4">
                    {a.audience} · from {new Date(a.starts_at).toLocaleString()}
                    {a.ends_at ? ` until ${new Date(a.ends_at).toLocaleString()}` : ''}
                    {a.url ? ` · ${a.url}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${live(a) ? 'bg-green/20 text-green' : 'bg-ink-750 text-fg-2'}`}>{live(a) ? 'live' : 'inactive'}</span>
                  <button type="button" onClick={() => remove(a.id)} className="text-[12px] text-danger">
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
