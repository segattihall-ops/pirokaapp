'use client';

import { useCallback, useEffect, useState } from 'react';

type Proposal = {
  id: string;
  conversation_id: string;
  proposer_id: string;
  invitee_id: string;
  place_label: string | null;
  when_text: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  created_at: string;
};

const detail = (p: Proposal) => [p.place_label, p.when_text].filter(Boolean).join(' · ');

/**
 * Meet Mode in a chat: one member proposes a meet (where / when), the other accepts or declines. This
 * is the social handshake — the safety timer is SafeMeet, shown separately.
 */
export function MeetPropose({
  conversationId,
  meId,
  peerHandle,
}: {
  conversationId: string;
  meId: string;
  peerHandle: string | null;
}) {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState('');
  const [when, setWhen] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const peer = peerHandle ? `@${peerHandle}` : 'them';

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/meet/propose?conversation=${conversationId}`, { cache: 'no-store' });
      if (!r.ok) return;
      const j = (await r.json()) as { proposal: Proposal | null };
      setProposal(j.proposal);
    } catch {
      /* transient */
    }
  }, [conversationId]);

  useEffect(() => {
    void load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, [load]);

  const propose = async () => {
    setBusy(true);
    setErr('');
    const r = await fetch('/api/meet/propose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        placeLabel: place.trim() || undefined,
        when: when.trim() || undefined,
      }),
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return setErr(typeof j.error === 'string' ? j.error : 'Could not send.');
    }
    setOpen(false);
    setPlace('');
    setWhen('');
    await load();
  };

  const respond = async (action: 'accept' | 'decline' | 'cancel') => {
    if (!proposal) return;
    setBusy(true);
    setErr('');
    const r = await fetch(`/api/meet/propose/${proposal.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return setErr(typeof j.error === 'string' ? j.error : 'Could not update.');
    }
    await load();
  };

  const pending = proposal?.status === 'pending';
  const iAmInvitee = proposal?.invitee_id === meId;

  return (
    <div className="mx-4 mt-2 flex flex-col gap-2 rounded-card border border-line-1 bg-ink-900 px-3.5 py-2.5">
      {pending && iAmInvitee ? (
        <>
          <p className="text-[13px] text-fg-2">
            <span className="font-semibold text-green">{peer}</span> suggested meeting
            {detail(proposal!) ? <span className="text-fg-3"> — {detail(proposal!)}</span> : null}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => respond('accept')}
              disabled={busy}
              className="btn-primary h-9 flex-1 bg-green text-[13px] hover:bg-green-hover"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => respond('decline')}
              disabled={busy}
              className="btn-secondary h-9 flex-1 text-[13px]"
            >
              Decline
            </button>
          </div>
        </>
      ) : pending ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] text-fg-3">
            Meet suggested{detail(proposal!) ? ` — ${detail(proposal!)}` : ''} · waiting for {peer}
          </p>
          <button
            type="button"
            onClick={() => respond('cancel')}
            disabled={busy}
            className="tap-link shrink-0 text-[12px] font-semibold text-fg-3"
          >
            Cancel
          </button>
        </div>
      ) : proposal?.status === 'accepted' ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] font-medium text-green">
            Meet on{detail(proposal) ? ` — ${detail(proposal)}` : ''}
          </p>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="tap-link shrink-0 text-[12px] font-semibold text-fg-3"
          >
            New time
          </button>
        </div>
      ) : !open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setErr('');
          }}
          className="tap-link self-start text-[13px] font-semibold text-green"
        >
          Propose a meet
        </button>
      ) : null}

      {open && (
        <div className="flex flex-col gap-2">
          <input
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            maxLength={80}
            placeholder="Where (optional)"
            aria-label="Where to meet"
            className="input h-10 font-normal text-fg"
          />
          <input
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            maxLength={80}
            placeholder="When (optional), e.g. tonight 9pm"
            aria-label="When to meet"
            className="input h-10 font-normal text-fg"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-secondary h-9 flex-1 text-[13px]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={propose}
              disabled={busy}
              className="btn-primary h-9 flex-1 bg-green text-[13px] hover:bg-green-hover"
            >
              {busy ? '…' : 'Send'}
            </button>
          </div>
        </div>
      )}

      {err && (
        <p role="alert" className="text-[12px] text-danger">
          {err}
        </p>
      )}
    </div>
  );
}
