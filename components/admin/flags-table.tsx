'use client';

import { useCallback, useEffect, useState } from 'react';

type Flag = { key: string; enabled: boolean; rollout_pct: number; description: string | null; updated_at: string };

export function FlagsTable() {
  const [flags, setFlags] = useState<Flag[] | null>(null);
  const [key, setKey] = useState('');
  const [desc, setDesc] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/flags', { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    setFlags(r.ok ? j.flags : []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const put = async (body: Partial<Flag> & { key: string }) => {
    setMsg('');
    const r = await fetch('/api/admin/flags', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setMsg(j.error ?? 'Save failed');
    load();
  };
  const del = async (k: string) => {
    if (!confirm(`Delete flag "${k}"? Code reading it will see false.`)) return;
    await fetch(`/api/admin/flags?key=${encodeURIComponent(k)}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!/^[a-z0-9_]{2,48}$/.test(key)) return setMsg('Key: lowercase letters, digits, underscores.');
          put({ key, description: desc || null, enabled: false, rollout_pct: 100 }).then(() => {
            setKey('');
            setDesc('');
          });
        }}
        className="flex flex-wrap gap-2"
      >
        <input value={key} onChange={(e) => setKey(e.target.value.toLowerCase())} placeholder="new_flag_key" className="input h-10 w-[200px] font-mono" />
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What it gates" className="input h-10 min-w-[200px] flex-1" />
        <button type="submit" className="btn-secondary h-10 text-[13px]">
          Add flag
        </button>
      </form>

      <div className="overflow-x-auto rounded-card border border-line-1">
        <table className="w-full text-[12px]">
          <thead className="bg-ink-900 text-left text-fg-3">
            <tr>
              <th className="px-3 py-2 font-medium">Key</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 font-medium">Enabled</th>
              <th className="px-3 py-2 font-medium">Rollout</th>
              <th className="px-3 py-2 font-medium">Updated</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {flags === null ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-fg-3">
                  Loading…
                </td>
              </tr>
            ) : flags.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-fg-4">
                  No flags. Env overrides (<code>FLAG_KEY=1</code>) still work.
                </td>
              </tr>
            ) : (
              flags.map((f) => (
                <tr key={f.key} className="border-t border-line-1">
                  <td className="px-3 py-2 font-mono text-fg">{f.key}</td>
                  <td className="px-3 py-2 text-fg-3">{f.description ?? '—'}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={f.enabled}
                      onClick={() => put({ key: f.key, enabled: !f.enabled })}
                      className={`relative h-6 w-11 rounded-chip border ${f.enabled ? 'border-sel-border bg-green' : 'border-line-3 bg-ink-800'}`}
                    >
                      <span className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white transition-transform ${f.enabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={f.rollout_pct}
                      onBlur={(e) => {
                        const v = Math.max(0, Math.min(100, Number(e.target.value)));
                        if (v !== f.rollout_pct) put({ key: f.key, rollout_pct: v });
                      }}
                      className="input h-8 w-[72px] py-0"
                      aria-label={`Rollout percentage for ${f.key}`}
                    />
                    <span className="ml-1 text-fg-4">%</span>
                  </td>
                  <td className="px-3 py-2 text-fg-3">{new Date(f.updated_at).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => del(f.key)} className="text-danger">
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {msg && (
        <p role="status" className="text-[12px] text-danger">
          {msg}
        </p>
      )}
      <p className="text-[11px] text-fg-4">
        Server: <code>isFlagEnabled(&apos;key&apos;, userId)</code>. Client: <code>useFlag(&apos;key&apos;)</code>. Percentage rollouts are sticky per user. Changes take up to 30 s.
      </p>
    </div>
  );
}
