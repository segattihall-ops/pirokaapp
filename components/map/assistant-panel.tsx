'use client';

import { useEffect, useRef, useState } from 'react';
import type { NearbyPerson } from '@/app/api/nearby/route';
import { distanceLabel, intentMeta } from '@/lib/geo/client';
import { parseSmartQuery, type Filters } from './filters';

type Msg = { bot?: boolean; me?: boolean; text: string; cards?: NearbyPerson[] };

const SUGGESTIONS = [
  'Who’s hosting near me?',
  'Vers guys under a mile',
  'Write me an opener',
  'Is this area safe?',
];

/**
 * The π assistant. It reads your words, sets the map filters (same on-device parser as the Filter sheet),
 * and surfaces the closest matching people as tappable cards. Harm-reduction answers are built in;
 * it never helps find or arrange drugs. Chats are not stored.
 */
export function AssistantPanel({
  people,
  premium,
  onApply,
  onOpenPerson,
  onClose,
}: {
  people: NearbyPerson[];
  premium: boolean;
  onApply: (f: Filters, chip: 'all' | 'now' | 'tonight' | 'hosting' | 'visitors') => void;
  onOpenPerson: (id: string) => void;
  onClose: () => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      bot: true,
      text: 'Hi, I’m πroka. Tell me who you’re in the mood to meet, or ask me anything about the app or staying safe.',
    },
  ]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, busy]);

  const answer = (q: string): Msg => {
    const t = q.toLowerCase();
    if (/(drug|chems?|\bpnp\b|party ?n ?play|meth|\bghb\b|\btina\b|molly|coke)/.test(t)) {
      return {
        bot: true,
        text: 'I can’t help find, buy or arrange drugs. If you use, harm reduction matters: never use alone, don’t mix GHB with alcohol, test for fentanyl, carry naloxone, and PEP works within 72 hours. See Chemsex & party safety in ME, or call 911 in an emergency.',
      };
    }
    if (/(opener|what.*say|message|text|first)/.test(t)) {
      return {
        bot: true,
        text: 'Keep it specific and low-pressure. Try: “Hey — your profile caught my eye. You around tonight?” or react to one detail they shared. Lead with a question so it’s easy to reply.',
      };
    }
    if (/(safe|safety|risky|danger)/.test(t)) {
      return {
        bot: true,
        text: 'Meet in public first, tell someone where you’re going, and use SafeMeet for timed check-ins and a trusted-contact link. Exact location only shares for 2 hours in Meet Mode. Quick exit is Esc twice.',
      };
    }
    const parsed = parseSmartQuery(q);
    onApply(parsed.filters, parsed.chip ?? 'all');
    const cards = people
      .filter((p) => p.intent && p.intent !== 'looking')
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, 3);
    const lead = /^try/i.test(parsed.note) ? '' : `${parsed.note}. `;
    return {
      bot: true,
      text: cards.length
        ? `${lead}Here are the closest people available now:`
        : `${lead}No one matches right now — try widening your filters.`,
      cards,
    };
  };

  const send = (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setMsgs((m) => [...m, { me: true, text: q }]);
    setDraft('');
    setBusy(true);
    // Mirror the prototype's brief "thinking" beat; the reply is computed on-device so nothing leaves the browser.
    window.setTimeout(() => {
      setMsgs((m) => [...m, answer(q)]);
      setBusy(false);
    }, 500);
  };

  return (
    <section
      aria-label="πroka assistant"
      className="glass fixed inset-0 z-50 flex h-dvh w-full flex-col overflow-hidden rounded-none shadow-panel rail:inset-x-auto rail:bottom-4 rail:right-4 rail:top-auto rail:h-[min(560px,70dvh)] rail:w-[390px] rail:rounded-sheet"
    >
      <div className="flex items-center justify-between border-b border-line-1 px-4 py-3.5">
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-sel-border bg-ink-950 font-bold text-green">
            π
          </span>
          <span className="flex flex-col">
            <span className="text-[14px] font-semibold">πroka</span>
            <span className="text-[11px] text-green">{premium ? 'Knows your type · Online' : 'Online'}</span>
          </span>
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close assistant"
          className="tap flex h-9 w-9 items-center justify-center rounded-full border border-line-2 text-fg-3 hover:text-fg"
        >
          ×
        </button>
      </div>
      <div ref={scrollRef} className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-4">
        {msgs.map((m, i) => (
          <div key={i} className={`flex flex-col gap-1.5 ${m.me ? 'items-end' : 'items-start'}`}>
            <div
              className={`max-w-[88%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                m.me
                  ? 'rounded-br-md bg-green font-medium text-ink-950'
                  : 'rounded-bl-md border border-line-1 bg-white/[0.06]'
              }`}
            >
              {m.text}
            </div>
            {m.cards?.map((c) => {
              const meta = intentMeta(c.intent);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onOpenPerson(c.id)}
                  className="tap flex w-full items-center justify-between gap-2.5 rounded-input border border-line-1 bg-black/30 px-3 py-2 text-left text-[13px] hover:border-sel-border"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: meta?.color ?? '#666' }}
                    />
                    <span className="truncate">
                      {c.handle ? `@${c.handle}` : 'Anonymous'} · {meta?.label ?? 'nearby'}
                    </span>
                  </span>
                  <span className="shrink-0 text-[12px] text-green">{distanceLabel(c.distanceM)}</span>
                </button>
              );
            })}
          </div>
        ))}
        {busy && (
          <div className="flex gap-1.5 self-start rounded-2xl rounded-bl-md border border-line-1 bg-white/[0.06] px-3.5 py-3">
            {[0, 0.15, 0.3].map((d) => (
              <span
                key={d}
                className="h-1.5 w-1.5 rounded-full bg-fg"
                style={{ animation: `piDot 1.2s ${d}s infinite` }}
              />
            ))}
          </div>
        )}
        {msgs.length === 1 && !busy && (
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-chip border border-line-2 bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium hover:border-sel-border"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-2 border-t border-line-1 p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send(draft)}
          placeholder="Ask anything — who’s around, an opener, safety…"
          aria-label="Message πroka"
          className="input h-11"
        />
        <button type="button" onClick={() => send(draft)} className="btn-primary h-11 px-4">
          Send
        </button>
      </div>
    </section>
  );
}
