'use client';

import { useCallback, useEffect, useState } from 'react';
import { ProfileSheet } from '@/components/map/profile-sheet';
import { UserRow, type CardUser } from '@/components/people/user-row';

type Row = { user: CardUser; at: string };

/** Who is asking to see my album, and who already can. */
export function AlbumInbox() {
  const [data, setData] = useState<{ requests: Row[]; grants: Row[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch('/api/album/requests', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { requests: [], grants: [] }))
      .then(setData)
      .catch(() => setData({ requests: [], grants: [] }));
  }, []);
  useEffect(load, [load]);

  const respond = async (userId: string, action: 'accept' | 'decline' | 'revoke') => {
    setBusy(userId);
    await fetch('/api/album/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action }),
    }).catch(() => {});
    setBusy(null);
    load();
  };

  const requests = data?.requests ?? [];
  const grants = data?.grants ?? [];

  return (
    <div id="album" className="glass flex flex-col rounded-card px-4 py-2">
      <p className="py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">
        Album requests{requests.length ? ` · ${requests.length}` : ''}
      </p>
      {!data ? (
        <p className="py-2 text-[13px] text-fg-4">Loading…</p>
      ) : requests.length === 0 ? (
        <p className="py-2 text-[13px] text-fg-4">Nobody is waiting. Photos 2–6 stay blurred until you let someone in.</p>
      ) : (
        requests.map((r) => (
          <UserRow key={r.user.id} user={r.user} sub="Wants to see your album" onOpen={() => setOpen(r.user.id)}>
            <button type="button" disabled={busy === r.user.id} onClick={() => respond(r.user.id, 'decline')} className="btn-ghost h-9 px-3 text-[13px]">
              Decline
            </button>
            <button
              type="button"
              disabled={busy === r.user.id}
              onClick={() => respond(r.user.id, 'accept')}
              className="btn-primary h-9 bg-green px-3 text-[13px] hover:bg-green-hover"
            >
              Accept
            </button>
          </UserRow>
        ))
      )}
      {grants.length > 0 && (
        <>
          <p className="border-t border-line-1 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">Can see your album · {grants.length}</p>
          {grants.map((r) => (
            <UserRow key={r.user.id} user={r.user} sub={`Since ${new Date(r.at).toLocaleDateString()}`} onOpen={() => setOpen(r.user.id)}>
              <button type="button" disabled={busy === r.user.id} onClick={() => respond(r.user.id, 'revoke')} className="btn-ghost h-9 px-3 text-[13px]">
                Revoke
              </button>
            </UserRow>
          ))}
        </>
      )}
      {open && <ProfileSheet userId={open} distanceM={null} onClose={() => setOpen(null)} />}
    </div>
  );
}
