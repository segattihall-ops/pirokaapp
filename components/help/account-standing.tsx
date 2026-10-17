'use client';

// Durations state what the moderation backend enforces (app/api/admin/mod-action: limit = 7 days, suspend = 30 days).
const LADDER = [
  { n: 'STEP 1', t: 'Warning', d: 'You get the reason and the rule. Nothing else changes.' },
  { n: 'STEP 2', t: 'Limited', d: 'Messaging new people paused for 7 days.' },
  { n: 'STEP 3', t: 'Suspended', d: '30 days. Profile hidden, chats kept.' },
  { n: 'STEP 4', t: 'Removed', d: 'For severe or repeated harm. Always appealable once.' },
];

/**
 * Account standing (Piroka_Help → Account standing). Until the standing/appeals backend lands this shows the
 * truthful default — good standing, no cases — rather than the prototype's sample warning.
 */
export function AccountStanding() {
  return (
    <>
      <h1 className="text-h1">Account standing</h1>
      <div className="flex items-center gap-3.5 rounded-card border border-sel-border bg-sel-fill p-[18px]">
        <span className="h-3 w-3 shrink-0 rounded-chip bg-green" />
        <span className="flex flex-col gap-[3px]">
          <span className="text-[16px] font-semibold">Good standing</span>
          <span className="text-[13px] text-fg-2">No restrictions on your account.</span>
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        <span className="text-[13px] font-semibold text-fg-3">How moderation works</span>
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
          {LADDER.map((l) => (
            <div key={l.n} className="flex flex-col gap-1 rounded-btn border border-line-1 bg-ink-850 p-3.5">
              <span className="text-[11px] font-bold text-green">{l.n}</span>
              <span className="text-[14px] font-semibold">{l.t}</span>
              <span className="text-[12px] leading-[1.45] text-fg-3">{l.d}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[13px] text-fg-3">
        Every action comes with the reason and the rule it relates to. A different moderator reviews every
        appeal and replies within 72 hours.
      </p>
    </>
  );
}
