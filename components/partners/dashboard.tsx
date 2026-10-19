'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { DAYS, typeLabel, type Hours, type Listing, type PartnerEvent } from '@/lib/partners/shared';
import { PartnerHeader } from './header';

type Stat = { label: string; v: string; d: string };

const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  const today = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: d.getMinutes() ? '2-digit' : undefined });
  return today
    ? `Tonight · ${time}`
    : d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** The partner dashboard (design_handoff → Piroka Partners.dc.html). Totals only, never identities. */
export function PartnerDashboard({ listings }: { listings: Listing[] }) {
  const [all, setAll] = useState(listings);
  const [selKey, setSelKey] = useState(listings[0].key);
  const cur = all.find((l) => l.key === selKey) ?? all[0];

  const [stats, setStats] = useState<Stat[] | null>(null);
  const [events, setEvents] = useState<PartnerEvent[] | null>(null);
  const [hours, setHours] = useState<Hours>(cur.hours);
  const [tags, setTags] = useState<string[]>(cur.tags);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const [evName, setEvName] = useState('');
  const [evDate, setEvDate] = useState('');
  const [evTime, setEvTime] = useState('21:00');
  const [evCap, setEvCap] = useState('');
  const [evAbout, setEvAbout] = useState('');
  const [posting, setPosting] = useState(false);

  const [toast, setToast] = useState('');
  const toastT = useRef<ReturnType<typeof setTimeout>>();
  const say = (t: string) => {
    setToast(t);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(''), 2600);
  };

  const enc = encodeURIComponent(cur.key);

  const loadStats = useCallback(async (key: string) => {
    setStats(null);
    const r = await fetch(`/api/partners/listings/${encodeURIComponent(key)}/stats`, { cache: 'no-store' }).catch(() => null);
    setStats(r?.ok ? ((await r.json()) as { stats: Stat[] }).stats : []);
  }, []);
  const loadEvents = useCallback(async (key: string) => {
    setEvents(null);
    const r = await fetch(`/api/partners/listings/${encodeURIComponent(key)}/events`, { cache: 'no-store' }).catch(() => null);
    setEvents(r?.ok ? ((await r.json()) as { events: PartnerEvent[] }).events : []);
  }, []);

  useEffect(() => {
    setHours(cur.hours);
    setTags(cur.tags);
    setDirty(false);
    void loadStats(cur.key);
    void loadEvents(cur.key);
  }, [cur, loadStats, loadEvents]);

  const setDay = (i: number, patch: Partial<Hours[number]>) => {
    setHours((h) => h.map((d, j) => (j === i ? { ...d, ...patch } : d)));
    setDirty(true);
  };
  const toggleTag = (t: string) => {
    setTags((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]));
    setDirty(true);
  };

  const publish = async () => {
    setSaving(true);
    const r = await fetch(`/api/partners/listings/${enc}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hours, tags }),
    }).catch(() => null);
    setSaving(false);
    if (!r?.ok) return say((r && (await r.json().catch(() => ({}))).error) || 'Could not publish. Try again.');
    setAll((ls) => ls.map((l) => (l.key === cur.key ? { ...l, hours, tags } : l)));
    setDirty(false);
    say('Published. Changes show in πroka within a few minutes.');
  };

  const postEvent = async () => {
    if (!evName.trim() || !evDate) return say('Add a name and a date.');
    setPosting(true);
    const r = await fetch(`/api/partners/listings/${enc}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: evName.trim(),
        date: evDate,
        time: evTime || '21:00',
        capacity: evCap ? Number(evCap) : null,
        about: evAbout.trim() || undefined,
      }),
    }).catch(() => null);
    setPosting(false);
    if (!r?.ok) return say((r && (await r.json().catch(() => ({}))).error) || 'Could not submit the event.');
    setEvName('');
    setEvDate('');
    setEvCap('');
    setEvAbout('');
    void loadEvents(cur.key);
    say('Submitted. A local ambassador reviews it, usually within a few hours.');
  };

  const clinic = cur.kind === 'testing_site';

  return (
    <>
      <PartnerHeader listings={all} selected={cur.key} onPick={setSelKey} />
      <main className="mx-auto flex w-full max-w-[960px] animate-in flex-col gap-4 px-4 py-5 sm:py-7">
        {/* Listing head */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[22px] font-semibold tracking-[-0.02em]">{cur.name}</span>
            <span className="truncate text-[13px] text-fg-3">
              {typeLabel(cur.type)}
              {cur.address ? ` · ${cur.address}` : ''}
            </span>
          </span>
          <span
            className={`inline-flex h-8 items-center gap-1.5 rounded-chip border px-3 text-[12px] font-semibold ${
              cur.verified ? 'border-sel-border text-green' : 'border-warning/50 text-warning'
            }`}
          >
            {cur.verified ? (
              <>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12l5 5L20 7" />
                </svg>
                Verified listing
              </>
            ) : (
              'Verification pending'
            )}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {(stats ?? Array.from({ length: 4 }, () => null)).map((st, i) => (
            <div key={st?.label ?? i} className="glass flex flex-col gap-0.5 rounded-card px-4 py-3.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">{st?.label ?? '—'}</span>
              <span className="text-[26px] font-semibold tracking-[-0.03em]">{st ? st.v : '…'}</span>
              <span className="text-[12px] text-fg-3">{st?.d ?? ''}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          {/* Hours + tags */}
          <section className="glass flex flex-col gap-3 rounded-card px-4 py-4">
            <span className="text-[15px] font-semibold">Hours</span>
            <div className="flex flex-col">
              {hours.map((h, i) => (
                <div key={DAYS[i]} className="flex min-h-[48px] items-center gap-2 border-t border-line-1 py-1.5 first:border-t-0">
                  <span className="w-9 shrink-0 text-[13px] font-medium">{DAYS[i]}</span>
                  {h.open ? (
                    <span className="flex min-w-0 flex-1 items-center gap-1.5">
                      <input
                        type="time"
                        value={h.from}
                        onChange={(e) => setDay(i, { from: e.target.value })}
                        aria-label={`${DAYS[i]} opens`}
                        className="input h-11 min-w-0 flex-1 px-2 py-0 text-[14px]"
                      />
                      <span className="text-fg-4">–</span>
                      <input
                        type="time"
                        value={h.to}
                        onChange={(e) => setDay(i, { to: e.target.value })}
                        aria-label={`${DAYS[i]} closes`}
                        className="input h-11 min-w-0 flex-1 px-2 py-0 text-[14px]"
                      />
                    </span>
                  ) : (
                    <span className="flex-1 text-[13px] text-fg-4">Closed</span>
                  )}
                  <button type="button" onClick={() => setDay(i, { open: !h.open })} className="btn-ghost h-11 shrink-0 px-2.5 text-[12px]">
                    {h.open ? 'Close day' : 'Open day'}
                  </button>
                </div>
              ))}
            </div>

            <span className="mt-1 text-[15px] font-semibold">{clinic ? 'Services' : 'What you offer'}</span>
            <div className="flex flex-wrap gap-1.5">
              {cur.tagPool.map((t) => {
                const on = tags.includes(t);
                return (
                  <button key={t} type="button" aria-pressed={on} onClick={() => toggleTag(t)} className={`chip ${on ? 'chip-selected' : ''}`}>
                    {t}
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={publish} disabled={saving || !dirty} className="btn-primary h-12 bg-green hover:bg-green-hover">
              {saving ? '…' : 'Publish changes'}
            </button>
          </section>

          {/* Events */}
          <section className="glass flex flex-col gap-3 rounded-card px-4 py-4">
            <span className="text-[15px] font-semibold">Post an event</span>
            <input value={evName} onChange={(e) => setEvName(e.target.value)} placeholder="Event name" aria-label="Event name" className="input h-12" maxLength={120} />
            <div className="grid grid-cols-[1.3fr_1fr_0.8fr] gap-2">
              <input type="date" min={todayIso()} value={evDate} onChange={(e) => setEvDate(e.target.value)} aria-label="Date" className="input h-12 min-w-0 px-2.5" />
              <input type="time" value={evTime} onChange={(e) => setEvTime(e.target.value)} aria-label="Start time" className="input h-12 min-w-0 px-2.5" />
              <input
                inputMode="numeric"
                value={evCap}
                onChange={(e) => setEvCap(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="Capacity"
                aria-label="Capacity"
                className="input h-12 min-w-0 px-2.5"
              />
            </div>
            <textarea value={evAbout} onChange={(e) => setEvAbout(e.target.value)} rows={3} placeholder="What should people know?" aria-label="About the event" className="input resize-none" maxLength={1000} />
            <span className="text-[12px] leading-[1.5] text-fg-3">
              Events are reviewed by a local ambassador before they appear on the map. No drug or sex-for-pay listings.
            </span>
            <button type="button" onClick={postEvent} disabled={posting} className="btn-secondary h-12">
              {posting ? '…' : 'Submit event'}
            </button>

            <span className="mt-1 text-[15px] font-semibold">Your events</span>
            {events === null ? (
              <p className="text-[13px] text-fg-3">Loading…</p>
            ) : events.length === 0 ? (
              <p className="text-[13px] text-fg-3">No events yet. Your first one shows here once it&apos;s submitted.</p>
            ) : (
              <div className="flex flex-col">
                {events.map((ev) => {
                  const live = ev.status === 'approved';
                  const label = live ? 'LIVE' : ev.status === 'pending' ? 'IN REVIEW' : 'NOT APPROVED';
                  return (
                    <div key={ev.id} className="flex items-center justify-between gap-3 border-t border-line-1 py-2.5 first:border-t-0">
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-[14px] font-medium">{ev.name}</span>
                        <span className="truncate text-[12px] text-fg-3">
                          {fmtWhen(ev.startsAt)} · {ev.rsvp} RSVP{ev.rsvp === 1 ? '' : 's'}
                          {ev.status === 'rejected' && ev.note ? ` · ${ev.note}` : ''}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className={`text-[10px] font-bold tracking-[0.1em] ${live ? 'text-green' : ev.status === 'pending' ? 'text-warning' : 'text-fg-4'}`}>{label}</span>
                        {live && (
                          <Link href={`/e/${ev.id}`} className="tap-link text-[12px] font-semibold text-green hover:text-green-hover">
                            Public page
                          </Link>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <span className="text-[12px] leading-[1.5] text-fg-4">
          Partners never see who checked in or RSVP&apos;d — only totals.{' '}
          <Link href="/help/support" className="text-green hover:text-green-hover">
            Partner support
          </Link>
        </span>
      </main>

      {toast && (
        <div role="status" className="fixed bottom-[calc(16px+var(--safe-bottom))] left-1/2 z-50 w-[min(420px,calc(100%-32px))] -translate-x-1/2 rounded-btn border border-line-2 bg-ink-800 px-4 py-3 text-center text-[13px] shadow-float">
          {toast}
        </div>
      )}
    </>
  );
}
