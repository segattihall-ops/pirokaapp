'use client';

import { useCallback, useEffect, useState } from 'react';

type Campaign = {
  id: string;
  subject: string;
  body: string;
  segment: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';
  scheduled_at: string | null;
  total_count: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
};
type Segment = { key: string; label: string; count: number };

const STATUS_STYLE: Record<Campaign['status'], string> = {
  draft: 'bg-ink-750 text-fg-2',
  scheduled: 'bg-indigo-900 text-indigo-200',
  sending: 'bg-yellow-900 text-yellow-200',
  sent: 'bg-green/20 text-green',
  cancelled: 'bg-red-900 text-red-200',
};

export function CampaignsEditor() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [sel, setSel] = useState<Campaign | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [segment, setSegment] = useState('all');
  const [when, setWhen] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/campaigns', { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setMsg(j.error ?? 'Could not load');
    setCampaigns(j.campaigns);
    setSegments(j.segments);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const pick = (c: Campaign | null) => {
    setSel(c);
    setSubject(c?.subject ?? '');
    setBody(c?.body ?? '');
    setSegment(c?.segment ?? 'all');
    setMsg('');
  };

  const call = async (method: string, url: string, payload?: unknown) => {
    setBusy(true);
    setMsg('');
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setMsg(j.error ?? 'Request failed');
      return null;
    }
    await load();
    return j;
  };

  const save = async () => {
    const payload = { subject, body, segment };
    const j = sel
      ? await call('PATCH', `/api/admin/campaigns/${sel.id}`, payload)
      : await call('POST', '/api/admin/campaigns', payload);
    if (j?.campaign) {
      setSel(j.campaign);
      setMsg('Saved.');
    }
  };
  const act = async (action: string) => {
    if (!sel) return;
    if (action === 'send_now' && !confirm(`Send "${sel.subject}" to the "${sel.segment}" segment now?`))
      return;
    const j = await call('PATCH', `/api/admin/campaigns/${sel.id}`, {
      action,
      scheduledAt: when ? new Date(when).toISOString() : undefined,
    });
    if (j?.campaign) {
      setSel(j.campaign);
      setMsg(action === 'send_now' ? 'Queued — the cron sends batches every 10 minutes.' : 'Done.');
    }
  };
  const test = async () => {
    if (!sel) return;
    const j = await call('POST', `/api/admin/campaigns/${sel.id}`);
    if (j) setMsg(j.ok ? `Test ${j.status} via ${j.provider}.` : `Test failed: ${j.error}`);
  };
  const remove = async () => {
    if (!sel || !confirm('Delete this campaign?')) return;
    const j = await call('DELETE', `/api/admin/campaigns/${sel.id}`);
    if (j) pick(null);
  };

  const editable = !sel || sel.status === 'draft' || sel.status === 'scheduled';
  const seg = segments.find((s) => s.key === segment);

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => pick(null)} className="btn-secondary h-10 text-[13px]">
          + New campaign
        </button>
        <div className="max-h-[600px] space-y-2 overflow-y-auto">
          {campaigns === null ? (
            <p className="py-6 text-center text-fg-3">Loading…</p>
          ) : campaigns.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-fg-4">No campaigns yet.</p>
          ) : (
            campaigns.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => pick(c)}
                className={`w-full rounded-card border p-3 text-left ${sel?.id === c.id ? 'border-green bg-white/[0.08]' : 'border-line-2 bg-white/5 hover:border-line-3'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-[13px] font-semibold">{c.subject}</p>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLE[c.status]}`}
                  >
                    {c.status}
                  </span>
                </div>
                <p className="text-[11px] text-fg-3">
                  {c.segment} ·{' '}
                  {c.status === 'draft'
                    ? new Date(c.created_at).toLocaleDateString()
                    : `${c.sent_count}/${c.total_count} sent${c.failed_count ? `, ${c.failed_count} failed` : ''}`}
                  {c.status === 'scheduled' && c.scheduled_at
                    ? ` · ${new Date(c.scheduled_at).toLocaleString()}`
                    : ''}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-card border border-line-2 bg-white/[0.04] p-4">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold text-fg-2">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={!editable}
            className="input h-10"
            maxLength={120}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold text-fg-2">Audience</span>
          <select
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
            disabled={!editable}
            className="input h-10 py-0"
          >
            {segments.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label} ({s.count.toLocaleString()})
              </option>
            ))}
          </select>
          {seg && (
            <span className="text-[11px] text-fg-4">
              {seg.count.toLocaleString()} recipients right now (opted-out and deleted accounts excluded).
            </span>
          )}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold text-fg-2">
            Body · Markdown-lite (**bold**, [link](https://…), blank line = paragraph)
          </span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={!editable}
            rows={10}
            className="input resize-y font-mono text-[12px]"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={busy || !editable || subject.trim().length < 3 || body.trim().length < 10}
            className="btn-primary h-10 text-[13px]"
          >
            {sel ? 'Save changes' : 'Create draft'}
          </button>
          {sel && (
            <>
              <button type="button" onClick={test} disabled={busy} className="btn-secondary h-10 text-[13px]">
                Send me a test
              </button>
              {editable && (
                <>
                  <input
                    type="datetime-local"
                    value={when}
                    onChange={(e) => setWhen(e.target.value)}
                    className="input h-10 w-auto"
                    aria-label="Schedule for"
                  />
                  <button
                    type="button"
                    onClick={() => act('schedule')}
                    disabled={busy || !when}
                    className="btn-secondary h-10 text-[13px]"
                  >
                    Schedule
                  </button>
                  <button
                    type="button"
                    onClick={() => act('send_now')}
                    disabled={busy}
                    className="h-10 rounded-btn bg-green px-4 text-[13px] font-semibold text-ink-950 disabled:opacity-40"
                  >
                    Send now
                  </button>
                </>
              )}
              {sel.status === 'scheduled' && (
                <button
                  type="button"
                  onClick={() => act('unschedule')}
                  disabled={busy}
                  className="btn-secondary h-10 text-[13px]"
                >
                  Unschedule
                </button>
              )}
              {sel.status !== 'sent' && sel.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={() => act('cancel')}
                  disabled={busy}
                  className="btn-ghost h-10 text-[13px] text-danger"
                >
                  Cancel
                </button>
              )}
              {sel.status !== 'sending' && (
                <button
                  type="button"
                  onClick={remove}
                  disabled={busy}
                  className="btn-ghost h-10 text-[13px] text-fg-3"
                >
                  Delete
                </button>
              )}
            </>
          )}
        </div>
        {msg && (
          <p role="status" className="text-[12px] text-fg-2">
            {msg}
          </p>
        )}
        <p className="text-[11px] text-fg-4">
          Every message carries an unsubscribe link and one-click header. The cron (
          <code>/api/cron/campaigns</code>) sends 100 per campaign per run and never emails the same person
          twice for one campaign.
        </p>
      </div>
    </div>
  );
}
