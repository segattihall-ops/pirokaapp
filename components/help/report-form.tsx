'use client';

import Link from 'next/link';
import { useState } from 'react';

const TYPES = [
  'Someone under 18',
  'Shared without consent',
  'Impersonation',
  'Harassment or threats',
  'Hate or discrimination',
  'Scam or spam',
  'Illegal content',
  'Other',
];

/** Public "Report or request removal" (Piroka_Help → Report content). No account needed; posts to /api/help/report. */
export function ReportForm() {
  const [type, setType] = useState('');
  const [link, setLink] = useState('');
  const [text, setText] = useState('');
  const [email, setEmail] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [id, setId] = useState<string | null>(null);

  const submit = async () => {
    if (!type || text.trim().length < 4) return setErr('Choose a reason and describe what happened.');
    setErr(null);
    setBusy(true);
    const r = await fetch('/api/help/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        link: link.trim() || undefined,
        text: text.trim(),
        email: email.trim() || undefined,
      }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    setBusy(false);
    if (r?.ok && j?.id) setId(j.id);
    else setErr(j?.error ?? 'Could not send the report. Please try again.');
  };

  const field =
    'rounded-btn border border-line-2 bg-ink-850 px-3.5 text-[14px] text-fg outline-none placeholder:text-fg-4 focus:border-sel-border';

  return (
    <>
      <h1 className="text-h1">Report or request removal</h1>
      <p className="-mt-2 text-[14px] leading-[1.55] text-fg-3">
        For content on πroka that shows you without consent, involves a minor, or breaks the law. You
        don&apos;t need an account. Minors and non-consensual content are removed first, usually within hours.
      </p>

      {id ? (
        <div className="flex flex-col gap-1.5 rounded-card border border-sel-border bg-sel-fill p-5">
          <span className="text-[16px] font-semibold">Report {id} received</span>
          <span className="text-[14px] leading-[1.5] text-fg-2">
            A person on our Trust &amp; Safety team will review it. If you left an email, we&apos;ll tell you
            what we did.
          </span>
        </div>
      ) : (
        <>
          <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
            {TYPES.map((t) => {
              const on = type === t;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  onClick={() => (setType(t), setErr(null))}
                  className={`rounded-btn border p-3.5 text-left text-[13px] font-medium text-fg ${
                    on ? 'border-sel-border bg-sel-fill' : 'border-line-2 bg-transparent'
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Profile name or link"
            aria-label="Profile name or link"
            className={`h-[46px] ${field}`}
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="What happened?"
            aria-label="What happened?"
            className={`resize-y py-3 leading-[1.5] ${field}`}
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Email for updates (optional)"
            aria-label="Email for updates"
            className={`h-[46px] ${field}`}
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="tap flex h-[46px] items-center self-start rounded-btn bg-green px-5 text-[14px] font-semibold text-ink-950 disabled:opacity-40"
          >
            {busy ? 'Sending…' : 'Send report'}
          </button>
          {err && (
            <span role="alert" className="text-[13px] text-danger">
              {err}{' '}
              {err.includes('unavailable') && (
                <Link href="/help/support" className="text-green">
                  Talk to a person
                </Link>
              )}
            </span>
          )}
        </>
      )}
    </>
  );
}
