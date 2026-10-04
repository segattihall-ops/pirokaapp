'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { distanceLabel, intentMeta, timeLeft } from '@/lib/geo/client';
import { SafetyMenu } from '@/components/chat/safety-menu';
import { Sheet } from './status-sheet';

type Profile = {
  id: string;
  handle: string | null;
  pronouns: string[];
  communities: string[];
  bio: string | null;
  verified: boolean;
  plan: string;
  intent: string | null;
  intentEndsAt: string | null;
  photos: { slot: number; url: string; blurred: boolean }[];
  albumUnlocked: boolean;
  albumRequest: 'self' | 'unlocked' | 'none' | 'pending' | 'accepted' | 'declined';
  favorite: boolean;
  favoriteAlerts: boolean;
  trips: { city: string; arriveOn: string; nights: number }[];
  conversation: boolean;
};

const fmtDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'UTC' });

export function ProfileSheet({
  userId,
  distanceM,
  onClose,
}: {
  userId: string;
  distanceM: number | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [p, setP] = useState<Profile | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState<'' | 'message' | 'album' | 'fav'>('');

  useEffect(() => {
    fetch(`/api/users/${userId}`, { cache: 'no-store' })
      .then(async (r) =>
        r.ok ? setP(await r.json()) : setErr((await r.json().catch(() => ({}))).error ?? 'Not found'),
      )
      .catch(() => setErr('Could not load profile'));
  }, [userId]);

  const message = async () => {
    setBusy('message');
    const r = await fetch('/api/chat/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy('');
    if (!r.ok) return setErr(j.error ?? 'Could not start chat');
    router.push(`/app/chats/${j.id}`);
  };

  const requestAlbum = async () => {
    if (!p) return;
    setBusy('album');
    setErr('');
    const r = await fetch('/api/album/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy('');
    if (!r.ok) return setErr(j.error ?? 'Could not send request');
    setP({ ...p, albumRequest: j.state === 'unlocked' ? 'unlocked' : j.state });
  };

  const toggleFavorite = async () => {
    if (!p) return;
    setBusy('fav');
    setErr('');
    const r = await fetch('/api/favorites', {
      method: p.favorite ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    setBusy('');
    if (!r.ok) return setErr((await r.json().catch(() => ({}))).error ?? 'Could not update favourites');
    setP({ ...p, favorite: !p.favorite });
  };

  const meta = intentMeta(p?.intent);
  const main = p?.photos.find((x) => x.slot === 0);
  const album = p?.photos.filter((x) => x.slot > 0) ?? [];

  return (
    <Sheet onClose={onClose}>
      {err && !p ? (
        <p className="py-6 text-center text-[13px] text-fg-3">{err}</p>
      ) : !p ? (
        <p className="py-6 text-center text-[13px] text-fg-3">Loading…</p>
      ) : (
        <>
          <div className="flex items-start gap-4">
            <div className="relative h-[150px] w-[112px] shrink-0 overflow-hidden rounded-card bg-ink-800">
              {main ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={main.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[32px] font-bold text-fg-3">
                  {(p.handle ?? '?').slice(0, 1).toUpperCase()}
                </span>
              )}
              {main?.blurred && (
                <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[10px] font-semibold text-fg-2">
                  clears when you chat
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-[20px] font-semibold tracking-[-0.02em]">
                  {p.handle ? `@${p.handle}` : 'Anonymous'}
                </h2>
                {p.verified && <span className="text-[12px] font-bold text-green">✓</span>}
              </div>
              <p className="text-[12px] text-fg-3">
                {p.pronouns.length ? p.pronouns.join(' / ') : 'no pronouns set'}
                {distanceM !== null ? ` · ${distanceLabel(distanceM)}` : ''}
              </p>
              {meta && (
                <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-chip border border-line-2 px-2.5 py-1 text-[12px] font-semibold">
                  <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
                  {meta.label} <span className="font-normal text-fg-3">· {timeLeft(p.intentEndsAt)}</span>
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {p.albumRequest !== 'self' && (
                <button
                  type="button"
                  onClick={toggleFavorite}
                  disabled={busy === 'fav'}
                  aria-pressed={p.favorite}
                  aria-label={p.favorite ? 'Remove from favourites' : 'Add to favourites'}
                  className={`tap-hit flex h-10 w-10 items-center justify-center rounded-[12px] border text-[18px] transition-colors ${
                    p.favorite
                      ? 'border-sel-border bg-sel-fill text-green'
                      : 'border-line-2 text-fg-3 hover:text-fg'
                  }`}
                >
                  {p.favorite ? '★' : '☆'}
                </button>
              )}
              <SafetyMenu peerUserId={p.id} peerHandle={p.handle} onBlocked={onClose} />
            </div>
          </div>

          {p.bio && <p className="text-[14px] leading-relaxed text-fg-2">{p.bio}</p>}

          {p.trips.length > 0 && (
            <p className="rounded-input border border-line-2 px-3 py-2 text-[12px] text-fg-2">
              ✈️{' '}
              {p.trips
                .map(
                  (t) =>
                    `${t.city.split(',')[0]} from ${fmtDate(t.arriveOn)} (${t.nights} night${t.nights === 1 ? '' : 's'})`,
                )
                .join(' · ')}
            </p>
          )}

          {p.communities.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {p.communities.map((c) => (
                <span key={c} className="rounded-chip border border-line-2 px-2.5 py-1 text-[12px] text-fg-2">
                  {c}
                </span>
              ))}
            </div>
          )}

          {album.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">
                  Album · {album.length} {p.albumUnlocked ? '' : '· private'}
                </p>
                {p.albumRequest === 'none' || p.albumRequest === 'declined' ? (
                  <button
                    type="button"
                    onClick={requestAlbum}
                    disabled={busy === 'album'}
                    className="tap-link text-[12px] font-semibold text-green"
                  >
                    {busy === 'album' ? '…' : 'Request access'}
                  </button>
                ) : p.albumRequest === 'pending' ? (
                  <span className="text-[12px] text-fg-3">Requested</span>
                ) : null}
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {album.map((x) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={x.slot}
                    src={x.url}
                    alt=""
                    className="aspect-square w-full rounded-[10px] object-cover"
                  />
                ))}
              </div>
            </div>
          )}

          {err && (
            <p role="alert" className="text-[12px] text-danger">
              {err}
            </p>
          )}
          {p.albumRequest !== 'self' && (
            <button
              type="button"
              onClick={message}
              disabled={busy === 'message'}
              className="btn-primary h-12 bg-green hover:bg-green-hover"
            >
              {busy === 'message' ? '…' : p.conversation ? 'Open chat' : 'Message'}
            </button>
          )}
          <p className="text-center text-[11px] text-fg-4">Messages are end-to-end encrypted.</p>
        </>
      )}
    </Sheet>
  );
}
