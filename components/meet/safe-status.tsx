'use client';

import { useCallback, useEffect, useState } from 'react';
import { MEET_TYPE_LABEL, type MeetType } from '@/lib/meet/shared';

type Status = {
  name: string;
  contactName: string | null;
  state: 'ok' | 'due' | 'overdue' | 'alert' | 'ended' | 'cancelled';
  meetType: MeetType;
  placeLabel: string | null;
  checkinEvery: number;
  startedAt: string;
  endsAt: string | null;
  lastCheckinAt: string | null;
  nextCheckinAt: string | null;
  alertAt: string | null;
  endedAt: string | null;
  checkins: number;
};

const UI: Record<Status['state'], { title: string; cls: string; bg: string; hint: string }> = {
  ok: { title: 'Checked in and OK', cls: 'text-green', bg: 'border-green/40', hint: 'Everything is on schedule.' },
  due: { title: 'Check-in due', cls: 'text-amber-400', bg: 'border-amber-400/40', hint: 'A check-in is a few minutes late. This is usually nothing — give it a moment.' },
  overdue: { title: 'Check-in missed', cls: 'text-danger', bg: 'border-danger/60', hint: 'They have not checked in past the grace period. Try calling them.' },
  alert: { title: 'NOT OK — they asked for help', cls: 'text-danger', bg: 'border-danger', hint: 'They pressed the alert button. Call them now; if you cannot reach them, contact emergency services.' },
  ended: { title: 'Home safe', cls: 'text-fg-2', bg: 'border-line-2', hint: 'The meet ended and they marked themselves safe.' },
  cancelled: { title: 'Cancelled', cls: 'text-fg-3', bg: 'border-line-2', hint: 'The meet did not happen.' },
};

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');

/** Polls the public status every 20 s. */
export function SafeStatus({ token }: { token: string }) {
  const [s, setS] = useState<Status | null | undefined>(undefined);
  const load = useCallback(async () => {
    const r = await fetch(`/api/safe/${token}`, { cache: 'no-store' }).catch(() => null);
    setS(r?.ok ? await r.json() : null);
  }, [token]);
  useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [load]);

  if (s === undefined) return <p className="text-[13px] text-fg-3">Loading…</p>;
  if (s === null) return <p className="text-[14px] text-fg-2">This link is not valid any more.</p>;
  const ui = UI[s.state];

  return (
    <div className={`glass flex flex-col gap-3 rounded-card border p-5 ${ui.bg}`}>
      <p className="text-[13px] text-fg-3">
        {s.contactName ? `Hi ${s.contactName}. ` : ''}
        {s.name} is meeting someone{s.placeLabel ? ` at ${s.placeLabel}` : ''} ({MEET_TYPE_LABEL[s.meetType].toLowerCase()}).
      </p>
      <h1 className={`text-[24px] font-semibold tracking-[-0.02em] ${ui.cls}`} data-state={s.state}>
        {ui.title}
      </h1>
      <p className="text-[14px] text-fg-2">{ui.hint}</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-line-1 pt-3 text-[13px]">
        <dt className="text-fg-3">Started</dt>
        <dd>{fmt(s.startedAt)}</dd>
        <dt className="text-fg-3">Last check-in</dt>
        <dd>{fmt(s.lastCheckinAt)}</dd>
        {s.state !== 'ended' && s.state !== 'cancelled' && (
          <>
            <dt className="text-fg-3">Next check-in</dt>
            <dd>{fmt(s.nextCheckinAt)}</dd>
          </>
        )}
        <dt className="text-fg-3">Planned end</dt>
        <dd>{fmt(s.endsAt)}</dd>
        {s.alertAt && (
          <>
            <dt className="text-fg-3">Alert sent</dt>
            <dd className="text-danger">{fmt(s.alertAt)}</dd>
          </>
        )}
        {s.endedAt && (
          <>
            <dt className="text-fg-3">Ended</dt>
            <dd>{fmt(s.endedAt)}</dd>
          </>
        )}
      </dl>
      <p className="text-[11px] text-fg-4">Updates every 20 seconds · check-ins every {s.checkinEvery} min</p>
    </div>
  );
}
