'use client';

import { useEffect, useState } from 'react';
import { MEET_TYPE_LABEL, deriveState, minutesUntil } from '@/lib/meet/shared';
import type { PublicMeet } from '@/lib/meet/server';

const STATE_UI: Record<string, { label: string; cls: string }> = {
  ok: { label: 'On track', cls: 'text-green' },
  due: { label: 'Check-in due', cls: 'text-amber-400' },
  overdue: { label: 'Check-in missed', cls: 'text-danger' },
  alert: { label: 'ALERT sent', cls: 'text-danger' },
  ended: { label: 'Ended safely', cls: 'text-fg-3' },
  cancelled: { label: 'Cancelled', cls: 'text-fg-3' },
};

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');

/** The owner's live SafeMeet: countdown, check-in, alert, end, and the link for the trusted contact. */
export function SafeMeetCard({ meet, onChange, compact = false }: { meet: PublicMeet; onChange: (m: PublicMeet | null) => void; compact?: boolean }) {
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const state = deriveState({ status: meet.status, next_checkin_at: meet.nextCheckinAt, ends_at: meet.endsAt }, now);
  const ui = STATE_UI[state];
  const live = meet.status === 'active' || meet.status === 'alert';
  const mins = minutesUntil(meet.nextCheckinAt, now);
  const link = meet.shareToken && typeof window !== 'undefined' ? `${window.location.origin}/safe/${meet.shareToken}` : '';

  const act = async (action: 'checkin' | 'extend' | 'end' | 'alert' | 'cancel') => {
    if (action === 'alert' && !confirm('Mark this meet as NOT OK? Your contact page turns red immediately.')) return;
    if (action === 'end' && !confirm('End SafeMeet? Your contact will see you got home safe.')) return;
    setBusy(action);
    setErr('');
    const r = await fetch(`/api/meet/${meet.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    const j = await r.json().catch(() => ({}));
    setBusy('');
    if (!r.ok) return setErr(j.error ?? 'Could not update');
    onChange(action === 'end' || action === 'cancel' ? null : j.meet);
  };

  const share = async () => {
    if (!link) return;
    const text = `I'm meeting someone tonight. This page shows my check-ins: ${link}`;
    if (navigator.share) {
      await navigator.share({ title: 'SafeMeet', text }).catch(() => {});
      return;
    }
    await navigator.clipboard?.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!meet.mine) {
    return (
      <div className="glass flex items-center gap-3 rounded-card px-4 py-3">
        <span className="text-[18px]">🛡️</span>
        <p className="text-[13px] text-fg-2">
          They set up a SafeMeet with you{meet.boundaries ? `. Boundaries: “${meet.boundaries}”` : '.'}
        </p>
      </div>
    );
  }

  return (
    <div className={`glass flex flex-col gap-2.5 rounded-card px-4 py-3.5 ${state === 'overdue' || state === 'alert' ? 'border-danger/50' : ''}`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">🛡️ SafeMeet · {MEET_TYPE_LABEL[meet.meetType]}</p>
        <span className={`text-[12px] font-semibold ${ui.cls}`}>{ui.label}</span>
      </div>
      {live && (
        <p className="text-[13px] text-fg-2">
          {mins === null ? '' : mins > 0 ? `Next check-in in ${mins} min (${fmt(meet.nextCheckinAt)})` : `Check-in was due ${fmt(meet.nextCheckinAt)}`}
          {meet.endsAt ? ` · ends ${fmt(meet.endsAt)}` : ''}
          {meet.checkins ? ` · ${meet.checkins} check-in${meet.checkins === 1 ? '' : 's'}` : ''}
        </p>
      )}
      {err && (
        <p role="alert" className="text-[12px] text-danger">
          {err}
        </p>
      )}
      {live && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => act('checkin')} disabled={busy !== ''} className="btn-primary h-11 flex-1 bg-green hover:bg-green-hover">
            {busy === 'checkin' ? '…' : 'I’m OK'}
          </button>
          <button type="button" onClick={() => act('alert')} disabled={busy !== ''} className="btn-secondary h-11 border-danger/50 text-danger">
            Not OK
          </button>
          {!compact && (
            <button type="button" onClick={() => act('extend')} disabled={busy !== ''} className="btn-secondary h-11">
              +1 h
            </button>
          )}
          <button type="button" onClick={() => act('end')} disabled={busy !== ''} className="btn-ghost h-11">
            End
          </button>
        </div>
      )}
      {live && link && (
        <div className="flex items-center justify-between gap-2 border-t border-line-1 pt-2.5">
          <p className="min-w-0 truncate text-[12px] text-fg-3">
            {meet.trustedContact?.name ? `Send to ${meet.trustedContact.name}: ` : 'Contact link: '}
            <span className="font-mono text-fg-4">{link.replace(/^https?:\/\//, '')}</span>
          </p>
          <div className="flex shrink-0 gap-1">
            {meet.trustedContact?.phone && (
              <a href={`sms:${meet.trustedContact.phone}?&body=${encodeURIComponent(`I'm meeting someone. My check-ins: ${link}`)}`} className="btn-secondary h-9 px-3 text-[12px]">
                SMS
              </a>
            )}
            <button type="button" onClick={share} className="btn-secondary h-9 px-3 text-[12px]">
              {copied ? 'Copied' : 'Share'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
