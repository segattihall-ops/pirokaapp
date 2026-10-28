'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { IN_APP_REASONS, IN_APP_REASON_LABELS, type InAppReason } from '@/lib/safety/reasons';

/**
 * The "⋯" safety menu shown on a profile and in a chat. Opens a bottom sheet with the same shape
 * as the rest of the app: Share health card · Report · Copy link · Block. Report is a guided,
 * icon-led flow over the twelve IN_APP_REASONS — pick a reason, add optional detail, send — ending
 * on a "Thank you" confirmation that offers Block and links to the policies. The backend contract is
 * unchanged: POST /api/safety/report with { targetId, reason, details, conversationId? } and
 * POST /api/safety/block with { targetId }. Props are unchanged so every call site keeps working.
 */

type Mode = 'menu' | 'report' | 'details' | 'done';

/** One inline icon per reason. stroke="currentColor", no fills, so colour follows the row. */
function ReasonIcon({ reason }: { reason: InAppReason }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (reason) {
    case 'underage':
      return (
        <svg {...common}>
          <path d="M12 3l7 3v5c0 4.2-2.8 7.4-7 8.5C7.8 18.4 5 15.2 5 11V6l7-3z" />
          <path d="M12 8v4" />
          <path d="M12 15h.01" />
        </svg>
      );
    case 'csam':
      return (
        <svg {...common}>
          <path d="M12 3l7 3v5c0 4.2-2.8 7.4-7 8.5C7.8 18.4 5 15.2 5 11V6l7-3z" />
          <path d="M9.5 9.5l5 5M14.5 9.5l-5 5" />
        </svg>
      );
    case 'threats':
      return (
        <svg {...common}>
          <path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      );
    case 'stalking':
      return (
        <svg {...common}>
          <path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    case 'sextortion':
      return (
        <svg {...common}>
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          <path d="M12 15v2" />
        </svg>
      );
    case 'ncii':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 16 5-5 4 4" />
          <path d="M3.5 4.5l16 15" />
        </svg>
      );
    case 'harassment':
      return (
        <svg {...common}>
          <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />
          <path d="M9 9.5l6 4M15 9.5l-6 4" />
        </svg>
      );
    case 'hate':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M5.6 5.6l12.8 12.8" />
        </svg>
      );
    case 'unsafe':
      return (
        <svg {...common}>
          <path d="M12 3l7 3v5c0 4.2-2.8 7.4-7 8.5C7.8 18.4 5 15.2 5 11V6l7-3z" />
          <path d="M9.2 12.2 11 14l4-4.5" />
        </svg>
      );
    case 'spam':
      return (
        <svg {...common}>
          <path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z" />
          <path d="M16 9a4 4 0 0 1 0 6" />
        </svg>
      );
    case 'impersonation':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
          <path d="M17.5 8.5l4 4M21.5 8.5l-4 4" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M4 5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 3z" />
          <path d="M9 10h.01M12.5 10h.01M16 10h.01" />
        </svg>
      );
  }
}

/** Reasons the UI treats as critical get a danger tint in the list, mirroring the severity ranks. */
const CRITICAL: ReadonlySet<InAppReason> = new Set([
  'underage',
  'csam',
  'threats',
  'stalking',
  'sextortion',
  'ncii',
]);

export function SafetyMenu({
  peerUserId,
  peerHandle,
  conversationId,
  onBlocked,
}: {
  peerUserId: string;
  peerHandle: string | null;
  conversationId?: string;
  onBlocked?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('menu');
  const [reason, setReason] = useState<InAppReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [shareMsg, setShareMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const name = peerHandle ? `@${peerHandle}` : 'this person';

  // Lock the page behind the sheet and allow Escape to dismiss, like the other modals.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = () => {
    setOpen(false);
    setMode('menu');
    setErr('');
    setShareMsg('');
    setCopied(false);
  };

  const shareHealth = async () => {
    setBusy(true);
    setErr('');
    setShareMsg('');
    const r = await fetch('/api/health/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ granteeId: peerUserId }),
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return setErr(
        r.status === 403
          ? 'Verify your health card in Me before sharing it.'
          : typeof j.error === 'string'
            ? j.error
            : 'Could not share your health card.',
      );
    }
    setShareMsg(`Your health card is now visible to ${name}.`);
  };

  const copyLink = async () => {
    setErr('');
    const url = `${window.location.origin}/app/map?user=${peerUserId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr('Could not copy the link.');
    }
  };

  const send = async () => {
    if (!reason) return;
    setBusy(true);
    setErr('');
    const r = await fetch('/api/safety/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetId: peerUserId,
        reason,
        details,
        ...(conversationId ? { conversationId } : {}),
      }),
    });
    setBusy(false);
    if (!r.ok) return setErr((await r.json().catch(() => ({}))).error ?? 'Could not send report');
    setMode('done');
  };

  const block = async () => {
    if (
      !confirm(
        `Block ${name}? They won't be able to message you and this chat will disappear from your inbox.`,
      )
    )
      return;
    setBusy(true);
    const r = await fetch('/api/safety/block', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: peerUserId }),
    });
    setBusy(false);
    if (!r.ok) return setErr('Could not block');
    close();
    if (onBlocked) onBlocked();
    else router.replace('/app/chats');
  };

  const Row = ({
    onClick,
    children,
    tone = 'default',
    icon,
    disabled,
  }: {
    onClick: () => void;
    children: React.ReactNode;
    tone?: 'default' | 'green' | 'danger';
    icon: React.ReactNode;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`tap flex w-full items-center gap-3 rounded-input px-3 py-3 text-left text-[15px] hover:bg-white/5 disabled:opacity-50 ${
        tone === 'green' ? 'text-green' : tone === 'danger' ? 'text-danger' : 'text-fg'
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-input ${
          tone === 'danger'
            ? 'bg-danger/10 text-danger'
            : tone === 'green'
              ? 'bg-green/10 text-green'
              : 'bg-white/5 text-fg-2'
        }`}
      >
        {icon}
      </span>
      <span className="flex-1">{children}</span>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
        className="text-fg-4"
      >
        <path d="m9 6 6 6-6 6" />
      </svg>
    </button>
  );

  return (
    <>
      <button
        type="button"
        aria-label="Safety options"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen(true);
          setMode('menu');
          setErr('');
        }}
        className="tap flex h-10 w-10 items-center justify-center rounded-[12px] text-fg-3 hover:bg-ink-850 hover:text-fg"
      >
        ⋯
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Safety options for ${name}`}
          className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm"
          />
          <div className="glass relative z-[1] w-full max-w-[440px] rounded-t-sheet border border-line-2 pb-[max(16px,var(--safe-bottom,16px))] shadow-sheet sm:rounded-sheet">
            <div className="flex justify-center pt-3 sm:hidden">
              <span className="h-1.5 w-10 rounded-chip bg-white/15" />
            </div>

            {/* Header */}
            <div className="flex items-center gap-2 px-4 pb-2 pt-3">
              {mode !== 'menu' && mode !== 'done' && (
                <button
                  type="button"
                  aria-label="Back"
                  onClick={() => setMode(mode === 'details' ? 'report' : 'menu')}
                  className="tap -ml-1 flex h-8 w-8 items-center justify-center rounded-input text-fg-3 hover:bg-white/5 hover:text-fg"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path d="m15 6-6 6 6 6" />
                  </svg>
                </button>
              )}
              <p className="flex-1 text-[15px] font-semibold text-fg">
                {mode === 'menu' && name}
                {mode === 'report' && 'Report — why?'}
                {mode === 'details' && 'Add detail'}
                {mode === 'done' && 'Thank you'}
              </p>
              <button
                type="button"
                aria-label="Close"
                onClick={close}
                className="tap flex h-8 w-8 items-center justify-center rounded-input text-fg-3 hover:bg-white/5 hover:text-fg"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-2 pb-1">
              {mode === 'menu' && (
                <div className="flex flex-col">
                  <Row
                    tone="green"
                    disabled={busy}
                    onClick={shareHealth}
                    icon={
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <path d="M12 9v6M9 12h6" />
                      </svg>
                    }
                  >
                    Share my health card
                  </Row>
                  <Row
                    onClick={() => {
                      setErr('');
                      setMode('report');
                    }}
                    icon={
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M4 21V4h11l-1 3 1 3H4" />
                      </svg>
                    }
                  >
                    Report {name}
                  </Row>
                  <Row
                    onClick={copyLink}
                    icon={
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M10 13a4 4 0 0 0 5.6 0l3-3A4 4 0 0 0 13 4.4l-1.5 1.5" />
                        <path d="M14 11a4 4 0 0 0-5.6 0l-3 3A4 4 0 0 0 11 19.6L12.4 18" />
                      </svg>
                    }
                  >
                    {copied ? 'Link copied' : 'Copy link to profile'}
                  </Row>
                  <Row
                    tone="danger"
                    disabled={busy}
                    onClick={block}
                    icon={
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <circle cx="12" cy="12" r="9" />
                        <path d="M5.6 5.6l12.8 12.8" />
                      </svg>
                    }
                  >
                    Block {name}
                  </Row>
                </div>
              )}

              {mode === 'report' && (
                <div className="flex flex-col">
                  {IN_APP_REASONS.map((value) => (
                    <Row
                      key={value}
                      tone={CRITICAL.has(value) ? 'danger' : 'default'}
                      icon={<ReasonIcon reason={value} />}
                      onClick={() => {
                        setReason(value);
                        setDetails('');
                        setMode('details');
                      }}
                    >
                      {IN_APP_REASON_LABELS[value]}
                    </Row>
                  ))}
                </div>
              )}

              {mode === 'details' && reason && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    send();
                  }}
                  className="flex flex-col gap-3 px-2 pb-3 pt-1"
                >
                  <div className="flex items-center gap-3 rounded-input bg-white/5 px-3 py-3">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-input ${CRITICAL.has(reason) ? 'bg-danger/10 text-danger' : 'bg-white/5 text-fg-2'}`}
                    >
                      <ReasonIcon reason={reason} />
                    </span>
                    <span className="text-[15px] font-medium text-fg">{IN_APP_REASON_LABELS[reason]}</span>
                  </div>
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    rows={4}
                    maxLength={2000}
                    placeholder="Add anything that helps a moderator (optional)"
                    className="input resize-none text-[14px]"
                  />
                  <p className="text-[12px] leading-[1.5] text-fg-4">
                    Messages stay encrypted; only what you write here is shared with moderators.
                    {CRITICAL.has(reason) && ' Reports about minors or violence are reviewed first.'}
                  </p>
                  <button type="submit" disabled={busy} className="btn-primary h-11 text-[14px]">
                    {busy ? 'Sending…' : 'Send report'}
                  </button>
                </form>
              )}

              {mode === 'done' && (
                <div className="flex flex-col items-center gap-3 px-4 pb-4 pt-2 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green/10 text-green">
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                  <p className="text-[17px] font-semibold text-fg">Thank you for your feedback</p>
                  <p className="max-w-[320px] text-[13px] leading-[1.55] text-fg-3">
                    A moderator will review your report. We don’t share the outcome, but we act on every
                    report. You can block {name} so they can’t reach you.
                  </p>
                  <button
                    type="button"
                    onClick={block}
                    disabled={busy}
                    className="btn-primary mt-1 h-11 w-full text-[14px]"
                  >
                    Block {name}
                  </button>
                  <button type="button" onClick={close} className="btn-secondary h-11 w-full text-[14px]">
                    Done
                  </button>
                  <p className="pt-1 text-[12px] leading-[1.6] text-fg-4">
                    <a className="underline hover:text-fg-2" href="/help/guidelines">
                      Community Guidelines
                    </a>{' '}
                    ·{' '}
                    <a className="underline hover:text-fg-2" href="/help/safety">
                      Safety
                    </a>{' '}
                    ·{' '}
                    <a className="underline hover:text-fg-2" href="/help/terms">
                      Terms
                    </a>
                  </p>
                </div>
              )}

              {err && (
                <p role="alert" className="px-3 pb-2 text-[12px] text-danger">
                  {err}
                </p>
              )}
              {shareMsg && <p className="px-3 pb-2 text-[12px] text-green">{shareMsg}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
