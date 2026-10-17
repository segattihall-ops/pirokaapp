'use client';

import { useState } from 'react';

/** Share the event page: native share sheet where available, otherwise copy the link (prototype behaviour). */
export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: `${title} · πroka`, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }
    } catch {}
  };
  return (
    <button
      type="button"
      onClick={share}
      className="tap h-11 flex-1 rounded-btn border border-line-3 bg-transparent text-[13px] font-semibold text-fg"
    >
      {copied ? 'Link copied ✓' : 'Share'}
    </button>
  );
}
