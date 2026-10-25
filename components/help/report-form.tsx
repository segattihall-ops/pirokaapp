'use client';

import Link from 'next/link';
import { useState } from 'react';
import { NCII_PUBLIC_LABEL } from '@/lib/legal/tida';
import { PUBLIC_REPORT_TYPES, type PublicReportType } from '@/lib/safety/reasons';

/** Public report/removal intake. No account required. NCII requests collect the federal written elements. */
export function ReportForm() {
  const [type, setType] = useState<PublicReportType | ''>('');
  const [link, setLink] = useState('');
  const [text, setText] = useState('');
  const [email, setEmail] = useState('');
  const [signature, setSignature] = useState('');
  const [capacity, setCapacity] = useState<'self' | 'authorized'>('self');
  const [goodFaith, setGoodFaith] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [deadlineAt, setDeadlineAt] = useState<string | null>(null);

  const ncii = type === NCII_PUBLIC_LABEL;

  const submit = async () => {
    if (!type || text.trim().length < 4) return setErr('Choose a reason and describe what happened.');
    if (ncii && !link.trim())
      return setErr('Give us a profile, URL, message, or other information that lets us locate the image.');
    if (ncii && !email.trim()) return setErr('A contact email is required for this removal request.');
    if (ncii && signature.trim().length < 2) return setErr('Type your full name as your electronic signature.');
    if (ncii && !goodFaith)
      return setErr('Confirm your good-faith belief that the intimate image was published without consent.');

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
        ...(ncii
          ? {
              tida: {
                signature: signature.trim(),
                capacity,
                goodFaith,
              },
            }
          : {}),
      }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    setBusy(false);
    if (r?.ok && j?.id) {
      setId(j.id);
      setDeadlineAt(typeof j.deadlineAt === 'string' ? j.deadlineAt : null);
    } else setErr(j?.error ?? 'Could not send the report. Please try again.');
  };

  const field =
    'rounded-btn border border-line-2 bg-ink-850 px-3.5 text-[14px] text-fg outline-none placeholder:text-fg-4 focus:border-sel-border';

  return (
    <>
      <h1 className="text-h1">Report or request removal</h1>
      <p className="-mt-2 text-[14px] leading-[1.55] text-fg-3">
        Report safety issues, illegal content, suspected minors, exploitation, or content shared without
        consent. You do not need a PIROKA account. Do not upload or resend suspected CSAM just to report it.
      </p>

      {id ? (
        <div className="flex flex-col gap-1.5 rounded-card border border-sel-border bg-sel-fill p-5">
          <span className="text-[16px] font-semibold">Request {id} received</span>
          <span className="text-[14px] leading-[1.5] text-fg-2">
            Trust &amp; Safety will review it. If you provided an email and follow-up is appropriate, we can
            contact you about the request.
          </span>
          {deadlineAt && (
            <span className="text-[13px] leading-[1.5] text-fg-3">
              This request was submitted through PIROKA&apos;s intimate-image removal process. For a valid
              request covered by the TAKE IT DOWN Act, required removal action is due no later than{' '}
              {new Date(deadlineAt).toLocaleString()}.
            </span>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
            {PUBLIC_REPORT_TYPES.map((t) => {
              const on = type === t;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setType(t);
                    setErr(null);
                  }}
                  className={`rounded-btn border p-3.5 text-left text-[13px] font-medium text-fg ${
                    on ? 'border-sel-border bg-sel-fill' : 'border-line-2 bg-transparent'
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>

          {ncii && (
            <div className="flex flex-col gap-3 rounded-card border border-sel-border bg-sel-fill/40 p-4">
              <div className="flex flex-col gap-1">
                <span className="text-[14px] font-semibold">Intimate-image removal request</span>
                <span className="text-[12px] leading-[1.55] text-fg-3">
                  Federal law requires a written request with an electronic signature, enough information to
                  locate the image, a good-faith non-consent statement, and contact information. A valid
                  covered request must be acted on as soon as possible and no later than 48 hours.
                </span>
              </div>

              <label className="flex flex-col gap-1.5 text-[12px] text-fg-3">
                I am submitting this request
                <select
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value as 'self' | 'authorized')}
                  className={`h-[46px] ${field}`}
                >
                  <option value="self">for myself as the person depicted</option>
                  <option value="authorized">as an authorized person acting for the person depicted</option>
                </select>
              </label>

              <input
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="Full legal name — electronic signature"
                aria-label="Electronic signature"
                autoComplete="name"
                className={`h-[46px] ${field}`}
              />

              <label className="flex gap-2.5 text-[12px] leading-[1.5] text-fg-2">
                <input
                  type="checkbox"
                  checked={goodFaith}
                  onChange={(e) => setGoodFaith(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-green"
                />
                <span>
                  I have a good-faith belief that the intimate image identified in this request depicts me
                  or the person I am authorized to represent and was published without that person&apos;s
                  consent.
                </span>
              </label>
            </div>
          )}

          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder={ncii ? 'Profile, URL, message, or other information to locate the image' : 'Profile name or link'}
            aria-label="Profile or content location"
            className={`h-[46px] ${field}`}
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder={
              ncii
                ? 'Briefly explain why you believe the publication was non-consensual and include any information that helps us identify the content.'
                : 'What happened?'
            }
            aria-label="Report details"
            className={`resize-y py-3 leading-[1.5] ${field}`}
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder={ncii ? 'Contact email (required)' : 'Email for updates (optional)'}
            aria-label="Email for updates"
            className={`h-[46px] ${field}`}
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="tap flex h-[46px] items-center self-start rounded-btn bg-green px-5 text-[14px] font-semibold text-ink-950 disabled:opacity-40"
          >
            {busy ? 'Sending…' : ncii ? 'Submit removal request' : 'Send report'}
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
