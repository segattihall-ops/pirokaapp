'use client';

import { useEffect, useState } from 'react';

type Invite = { code: string | null; url: string | null; joined: number };

/**
 * ME → Invite friends (FEATURES §9). Shows the member's own invite link, a copy/share control, and
 * how many friends have joined through it. The reward — a month of πroka Plus for both — is the
 * program; it is recorded when a friend joins and applies once they are on a paid plan.
 */
export function ReferralProgram() {
  const [data, setData] = useState<Invite | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/referrals/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setData(j))
      .catch(() => setData(null));
  }, []);

  if (!data || !data.url) return null;
  const url = data.url;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const share = () => {
    if (navigator.share) navigator.share({ title: 'πroka', url }).catch(() => {});
    else void copy();
  };

  return (
    <div className="glass flex flex-col gap-3 rounded-card px-4 py-3.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">Invite friends</p>
        {data.joined > 0 && (
          <span className="rounded-chip bg-sel-fill px-2 py-0.5 text-[11px] font-semibold text-green">
            {data.joined} joined
          </span>
        )}
      </div>

      <p className="text-[13px] leading-[1.5] text-fg-4">
        Share your link. When a friend joins, you both get a month of πroka Plus.
      </p>

      <div className="flex items-center gap-2 rounded-input border border-line-2 bg-ink-900 px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-[13px] text-fg-2">{url}</span>
        <button type="button" onClick={copy} className="shrink-0 text-[12px] font-semibold text-green">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <button
        type="button"
        onClick={share}
        className="btn-secondary flex h-10 items-center justify-center gap-2 text-[13px]"
      >
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
        </svg>
        Share invite
      </button>
    </div>
  );
}
