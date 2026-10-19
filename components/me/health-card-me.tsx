'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Card = {
  status: 'verified' | 'pending' | string;
  hiv_month: number | null;
  sti_month: number | null;
  prevention: string[] | null;
  visibility: string | null;
  verified_tests: string[] | null;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (m: number | null) => (m === null || m < 0 || m > 11 ? '—' : MONTHS[m]);
const today = () => new Date().toISOString().slice(0, 10);

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = reject;
    r.readAsDataURL(file);
  });

/**
 * ME → Sexual health card. Reads /api/health; lets you submit a test document, which the API checks
 * with AI (month + test type only — the image is never stored) and either verifies or sends to review.
 */
export function HealthCardMe() {
  const [card, setCard] = useState<Card | null | undefined>(undefined); // undefined = loading
  const [open, setOpen] = useState(false);
  const [testType, setTestType] = useState<'hiv' | 'sti'>('hiv');
  const [testDate, setTestDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    fetch('/api/health', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { card: null }))
      .then((j) => setCard(j.card ?? null))
      .catch(() => setCard(null));
  }, []);
  useEffect(load, [load]);

  const submit = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return setErr('Choose a photo of your test result first.');
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const imageBase64 = await fileToBase64(file);
      const r = await fetch('/api/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, testType, testDate }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? 'Could not read that document');
      setMsg(j.verified ? 'Verified — added to your card.' : 'Sent for a quick human review.');
      setOpen(false);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div id="health" className="glass flex flex-col gap-2 rounded-card px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">Sexual health</p>
        {card && (
          <span
            className={`rounded-chip px-2 py-0.5 text-[11px] font-semibold ${
              card.status === 'verified' ? 'bg-sel-fill text-green' : 'text-warning'
            }`}
          >
            {card.status === 'verified' ? 'Verified' : 'In review'}
          </span>
        )}
      </div>

      {card === undefined ? (
        <p className="py-1 text-[13px] text-fg-4">Loading…</p>
      ) : card === null ? (
        <p className="text-[13px] leading-[1.5] text-fg-4">
          Add a test result and πroka keeps only the month and type — never the image. You choose who sees it.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5 text-[13px] text-fg-2">
          <div className="flex gap-4">
            <span>
              <span className="text-fg-4">Last HIV:</span> {monthLabel(card.hiv_month)}
            </span>
            <span>
              <span className="text-fg-4">Last STI:</span> {monthLabel(card.sti_month)}
            </span>
          </div>
          {card.prevention && card.prevention.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {card.prevention.map((p) => (
                <span key={p} className="chip">
                  {p}
                </span>
              ))}
            </div>
          )}
          <p className="text-[12px] text-fg-4">
            Shared from a conversation&apos;s ⋯ menu. Visibility: {card.visibility ?? 'private'}.
          </p>
        </div>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setErr('');
            setMsg('');
          }}
          className="btn-secondary mt-1 h-10 text-[13px]"
        >
          {card ? 'Add a newer test' : 'Add a test result'}
        </button>
      ) : (
        <div className="mt-1 flex flex-col gap-2 rounded-input border border-line-1 p-3">
          <div className="flex gap-1.5">
            {(['hiv', 'sti'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTestType(t)}
                className={`chip ${testType === t ? 'chip-selected' : ''}`}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-fg-3">
            Test date
            <input
              type="date"
              max={today()}
              value={testDate}
              onChange={(e) => setTestDate(e.target.value)}
              className="input h-11 font-normal text-fg"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-fg-3">
            Result document
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="text-[13px] font-normal text-fg-3 file:mr-3 file:rounded-chip file:border-0 file:bg-ink-800 file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-fg"
            />
          </label>
          {err && (
            <p role="alert" className="text-[12px] text-danger">
              {err}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-secondary h-10 flex-1 text-[13px]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="btn-primary h-10 flex-1 bg-green text-[13px] hover:bg-green-hover"
            >
              {busy ? 'Checking…' : 'Submit'}
            </button>
          </div>
        </div>
      )}

      {msg && <p className="text-[12px] text-green">{msg}</p>}
    </div>
  );
}
