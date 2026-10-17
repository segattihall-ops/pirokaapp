'use client';

import Link from 'next/link';
import { useState } from 'react';
import { FAQ } from '@/lib/help-content';

/** Help center: searchable FAQ accordion + "Talk to a person" (Piroka_Help → Help center). */
export function HelpCenter() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(0);
  const ql = q.toLowerCase();
  const faqs = FAQ.map((f, i) => ({ ...f, i })).filter(
    (f) => !ql || `${f.q} ${f.a}`.toLowerCase().includes(ql),
  );

  return (
    <>
      <h1 className="text-h1">How can we help?</h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search help — “ban”, “location”, “delete account”…"
        aria-label="Search help"
        className="h-[50px] rounded-btn border border-line-2 bg-ink-850 px-4 text-[15px] text-fg outline-none placeholder:text-fg-4 focus:border-sel-border"
      />
      <div className="flex flex-col gap-2">
        {faqs.map((f) => {
          const isOpen = open === f.i || Boolean(ql);
          return (
            <button
              key={f.i}
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(open === f.i ? -1 : f.i)}
              className="flex flex-col gap-2 rounded-btn border border-line-1 bg-ink-850 px-[18px] py-4 text-left"
            >
              <span className="flex justify-between gap-3 text-[15px] font-semibold">
                {f.q}
                <span className="text-green">{isOpen ? '−' : '+'}</span>
              </span>
              {isOpen && (
                <span className="text-[14px] leading-[1.6] text-fg-2 [text-wrap:pretty]">{f.a}</span>
              )}
            </button>
          );
        })}
        {faqs.length === 0 && (
          <span className="text-[14px] text-fg-3">
            Nothing matches.{' '}
            <Link href="/help/support" className="text-green">
              Ask a person
            </Link>
            .
          </span>
        )}
      </div>
      <Link
        href="/help/support"
        className="tap flex h-[46px] items-center self-start rounded-btn bg-green px-[18px] text-[14px] font-semibold text-ink-950"
      >
        Talk to a person
      </Link>
    </>
  );
}
