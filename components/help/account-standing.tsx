'use client';

import { useEffect, useState } from 'react';

type ActionRow = {
  id: string;
  step: string;
  reason: string;
  rule_ref: string;
  created_at: string;
  expires_at: string | null;
  appeal: { action_id: string; status: string | null; created_at: string | null } | null;
};

const LADDER = [
  { n: 'STEP 1', t: 'Warning', d: 'Reason and rule provided; serious cases may skip this step.' },
  { n: 'STEP 2', t: 'Limited', d: 'Selected features can be restricted for a defined period.' },
  { n: 'STEP 3', t: 'Suspended', d: 'Access can be temporarily blocked and the profile hidden.' },
  { n: 'STEP 4', t: 'Removed', d: 'Severe or repeated violations may result in account removal.' },
];

export function AccountStanding() {
  const [actions, setActions] = useState<ActionRow[] | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [actionId, setActionId] = useState('');
  const [email, setEmail] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    const r = await fetch('/api/help/appeal', { cache: 'no-store' }).catch(() => null);
    if (r?.status === 401) {
      setSignedOut(true);
      setActions([]);
      return;
    }
    if (!r?.ok) {
      setActions([]);
      return;
    }
    const j = (await r.json()) as { actions?: ActionRow[] };
    setSignedOut(false);
    setActions(j.actions ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async () => {
    if (!/^PR-[A-Za-z0-9]{1,24}$/.test(actionId.trim()))
      return setErr('Enter the moderation action ID shown with the decision (for example, PR-12345).');
    if (body.trim().length < 10) return setErr('Explain why you believe the decision should be changed.');
    if (signedOut && !email.trim()) return setErr('Enter the email associated with the account.');

    setBusy(true);
    setErr(null);
    setResult(null);
    const r = await fetch('/api/help/appeal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionId: actionId.trim(),
        body: body.trim(),
        email: email.trim() || undefined,
      }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    setBusy(false);
    if (!r?.ok) return setErr(j?.error ?? 'Could not submit the appeal.');

    setResult(`Appeal received for ${j.actionId}. Status: ${j.status ?? 'pending'}.`);
    setBody('');
    if (!signedOut) void load();
  };

  const field =
    'rounded-btn border border-line-2 bg-ink-850 px-3.5 text-[14px] text-fg outline-none placeholder:text-fg-4 focus:border-sel-border';

  return (
    <>
      <h1 className="text-h1">Account standing &amp; appeals</h1>
      <p className="-mt-2 text-[14px] leading-[1.55] text-fg-3">
        Review moderation actions tied to your signed-in account, or submit an appeal using the action ID.
        If a suspension prevents sign-in, use the account email associated with that action.
      </p>

      <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
        {LADDER.map((l) => (
          <div key={l.n} className="flex flex-col gap-1 rounded-btn border border-line-1 bg-ink-850 p-3.5">
            <span className="text-[11px] font-bold text-green">{l.n}</span>
            <span className="text-[14px] font-semibold">{l.t}</span>
            <span className="text-[12px] leading-[1.45] text-fg-3">{l.d}</span>
          </div>
        ))}
      </div>

      {actions === null ? (
        <span className="text-[13px] text-fg-3">Loading account standing…</span>
      ) : signedOut ? (
        <div className="rounded-card border border-line-1 bg-ink-900 p-4 text-[13px] leading-[1.55] text-fg-3">
          You are not signed in. You can still appeal a suspension or removal below if you have the action
          ID and the email associated with the account.
        </div>
      ) : actions.length === 0 ? (
        <div className="flex items-center gap-3 rounded-card border border-sel-border bg-sel-fill p-4">
          <span className="h-3 w-3 shrink-0 rounded-chip bg-green" />
          <span className="text-[13px] text-fg-2">No moderation actions were found for this account.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-fg-3">Your moderation actions</span>
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => {
                setActionId(action.id);
                setErr(null);
                setResult(null);
              }}
              className="flex flex-col gap-1 rounded-btn border border-line-1 bg-ink-850 p-3.5 text-left hover:border-sel-border"
            >
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[14px] font-semibold">
                  {action.step} · {action.id}
                </span>
                {action.appeal && (
                  <span className="rounded-chip border border-line-2 px-2 py-0.5 text-[11px] text-fg-3">
                    appeal: {action.appeal.status ?? 'pending'}
                  </span>
                )}
              </span>
              <span className="text-[12px] text-fg-3">{action.reason}</span>
              <span className="text-[11px] text-fg-4">
                Rule: {action.rule_ref} · {new Date(action.created_at).toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-card border border-line-1 bg-ink-900 p-4">
        <span className="text-[14px] font-semibold">Submit an appeal</span>
        <input
          value={actionId}
          onChange={(e) => setActionId(e.target.value)}
          placeholder="Moderation action ID (PR-…)"
          aria-label="Moderation action ID"
          className={`h-[46px] ${field}`}
        />
        {signedOut && (
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Email associated with the account"
            aria-label="Account email"
            className={`h-[46px] ${field}`}
          />
        )}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          placeholder="Why should this decision be changed? Include any relevant context or evidence."
          aria-label="Appeal explanation"
          className={`resize-y py-3 leading-[1.5] ${field}`}
        />
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="tap flex h-[46px] items-center self-start rounded-btn bg-green px-5 text-[14px] font-semibold text-ink-950 disabled:opacity-40"
        >
          {busy ? 'Submitting…' : 'Submit appeal'}
        </button>
        {result && <span className="text-[13px] text-green">{result}</span>}
        {err && (
          <span role="alert" className="text-[13px] text-danger">
            {err}
          </span>
        )}
      </div>

      <p className="text-[12px] leading-[1.55] text-fg-4">
        Appeals are reviewed against the original rule and available evidence. PIROKA may withhold reporter
        identity, illegal material, security methods, or information that could endanger someone or interfere
        with an investigation.
      </p>
    </>
  );
}
