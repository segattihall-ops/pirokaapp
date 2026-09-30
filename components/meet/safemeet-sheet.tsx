'use client';

import { useState } from 'react';
import { Sheet } from '@/components/map/status-sheet';
import { CHECKIN_OPTIONS, ETA_OPTIONS, MEET_TYPE_LABEL, type MeetType } from '@/lib/meet/shared';
import type { PublicMeet } from '@/lib/meet/server';

/** Start a SafeMeet for this chat. Boundaries go to the other person; the contact and link stay yours. */
export function SafeMeetSheet({
  conversationId,
  peerHandle,
  onStarted,
  onClose,
}: {
  conversationId: string;
  peerHandle: string | null;
  onStarted: (m: PublicMeet) => void;
  onClose: () => void;
}) {
  const [meetType, setMeetType] = useState<MeetType>('public');
  const [eta, setEta] = useState(120);
  const [every, setEvery] = useState(30);
  const [place, setPlace] = useState('');
  const [boundaries, setBoundaries] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const name = peerHandle ? `@${peerHandle}` : 'them';

  const start = async () => {
    setBusy(true);
    setErr('');
    const r = await fetch('/api/meet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        meetType,
        etaMinutes: eta,
        checkinEvery: every,
        placeLabel: place || undefined,
        boundaries: boundaries || undefined,
        trustedContact: contactName.trim() ? { name: contactName.trim(), phone: contactPhone.trim() || undefined } : undefined,
      }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(j.error ?? 'Could not start SafeMeet');
    onStarted(j.meet);
  };

  const label = (min: number) => (min < 60 ? `${min} min` : `${min / 60} h`);

  return (
    <Sheet title="SafeMeet" onClose={onClose}>
      <p className="-mt-2 text-[13px] text-fg-3">
        Meeting {name}? Set check-ins and a person who can see you are OK. Only your boundaries are shared with {name}.
      </p>

      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">Where</p>
        <div className="flex gap-1.5">
          {(Object.keys(MEET_TYPE_LABEL) as MeetType[]).map((t) => (
            <button key={t} type="button" aria-pressed={meetType === t} onClick={() => setMeetType(t)} className={`chip flex-1 justify-center ${meetType === t ? 'chip-selected' : ''}`}>
              {MEET_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        <input value={place} onChange={(e) => setPlace(e.target.value.slice(0, 80))} placeholder="Place name (optional, shown to your contact)" aria-label="Place name" className="input h-11" />
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">How long</p>
        <div className="flex flex-wrap gap-1.5">
          {ETA_OPTIONS.map((m) => (
            <button key={m} type="button" aria-pressed={eta === m} onClick={() => setEta(m)} className={`chip ${eta === m ? 'chip-selected' : ''}`}>
              {label(m)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">Check in every</p>
        <div className="flex gap-1.5">
          {CHECKIN_OPTIONS.map((m) => (
            <button key={m} type="button" aria-pressed={every === m} onClick={() => setEvery(m)} className={`chip flex-1 justify-center ${every === m ? 'chip-selected' : ''}`}>
              {m} min
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">Boundaries (sent to {name})</p>
        <textarea value={boundaries} onChange={(e) => setBoundaries(e.target.value.slice(0, 280))} rows={2} placeholder="e.g. Drinks only tonight. No photos. I leave by midnight." aria-label="Boundaries" className="input" />
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">Trusted contact (optional)</p>
        <div className="flex gap-2">
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Name" aria-label="Contact name" className="input h-11 flex-1" />
          <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Phone" aria-label="Contact phone" inputMode="tel" className="input h-11 flex-1" />
        </div>
        <p className="text-[12px] text-fg-4">You get a link to send them. It shows your check-in status, nothing else.</p>
      </div>

      {err && (
        <p role="alert" className="text-[12px] text-danger">
          {err}
        </p>
      )}
      <button type="button" onClick={start} disabled={busy} className="btn-primary h-12 bg-green hover:bg-green-hover">
        {busy ? '…' : 'Start SafeMeet'}
      </button>
    </Sheet>
  );
}
