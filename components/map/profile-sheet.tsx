'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { intentMeta, timeLeft } from '@/lib/geo/client';
import { approx, tripText } from '@/lib/map/pin-anatomy';
import { MAP_ICON_PATHS } from '@/lib/design/icon-paths';
import { flagUrl } from './place-pins';
import { SafetyMenu } from '@/components/chat/safety-menu';
import { Sheet } from './status-sheet';
import { MutualReveal } from './mutual-reveal';

type Profile = {
  id: string;
  handle: string | null;
  pronouns: string[];
  communities: string[];
  bio: string | null;
  verified: boolean;
  emailVerified?: boolean;
  photoVerified?: boolean;
  plan: string;
  originCode?: string | null;
  intent: string | null;
  intentEndsAt: string | null;
  photos: { slot: number; url: string; blurred: boolean }[];
  albumUnlocked: boolean;
  albumRequest: 'self' | 'unlocked' | 'none' | 'pending' | 'accepted' | 'declined';
  favorite: boolean;
  favoriteAlerts: boolean;
  trips: { city: string; arriveOn: string; nights: number; arrivalTime?: string | null; departOn?: string | null; departureTime?: string | null }[];
  conversation: boolean;
};

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
  const [busy, setBusy] = useState<'' | 'message' | 'album' | 'fav' | 'interest'>('');
  const [signalled, setSignalled] = useState(false);
  const [reveal, setReveal] = useState<string | null>(null);

  const interest = async () => {
    if (!p) return;
    setBusy('interest');
    setErr('');
    const r = await fetch('/api/interest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy('');
    if (!r.ok) return setErr(j.error ?? 'Could not send');
    setSignalled(true);
    if (j.mutual) setReveal(j.reveal?.name ?? 'Someone');
  };

  const [match, setMatch] = useState<{ locked: boolean; score?: number | null; reasons?: string[] } | null>(null);
  useEffect(() => {
    fetch('/api/match?userId=' + encodeURIComponent(userId), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setMatch(j))
      .catch(() => null);
    fetch('/api/taste', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, kind: 'open' }),
    }).catch(() => null);
  }, [userId]);

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
                  Blurred until mutual
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-[20px] font-semibold tracking-[-0.02em]">
                  {p.handle ? `@${p.handle}` : 'Anonymous'}
                </h2>
                {p.verified && <span className="text-[12px] font-bold text-green">✓</span>}
                {p.emailVerified && (
                  <span
                    title="Email verified"
                    className="rounded-chip bg-sel-fill px-1.5 py-0.5 text-[10px] font-semibold text-green"
                  >
                    Email
                  </span>
                )}
                {p.photoVerified && (
                  <span
                    title="Photo verified — a live selfie matched these photos"
                    className="rounded-chip bg-sel-fill px-1.5 py-0.5 text-[10px] font-semibold text-green"
                  >
                    Photo
                  </span>
                )}
              </div>
              {p.originCode && (
                <p className="mt-1 flex items-center gap-2 text-[12px] text-fg-2">
                  {/^(?:[a-z]{2}|us-[a-z]{2})$/i.test(p.originCode) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={flagUrl(p.originCode)} alt="" width={20} height={14} className="h-[14px] w-5 rounded-[3px] object-cover" />
                  )}
                  <span>{p.trips.length ? 'Coming from' : 'From'} {p.originCode}</span>
                </p>
              )}
              <p className="text-[12px] text-fg-3">
                {p.pronouns.length ? p.pronouns.join(' / ') : 'no pronouns set'}
                {distanceM !== null ? ` · ${approx(distanceM)}` : ''}
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

          {match && !match.locked && match.score != null && (
            <div className="flex items-center gap-3 rounded-card border border-line-2 px-3.5 py-3">
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink-900 text-[13px] font-bold text-green"
                style={{
                  background: `conic-gradient(#34d399 ${Math.round((match.score / 100) * 360)}deg, rgba(255,255,255,0.12) 0)`,
                }}
                aria-label={`${match.score}% your type`}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-900">{match.score}</span>
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold">★ {match.score}% your type</p>
                {match.reasons && match.reasons.length > 0 && (
                  <p className="truncate text-[12px] text-fg-3">{match.reasons.join(' · ')}</p>
                )}
              </div>
            </div>
          )}
          {match?.locked && (
            <p className="rounded-card border border-dashed border-line-2 px-3.5 py-2.5 text-[12px] text-fg-3">
              ★ See how well they match your type. Premium.
            </p>
          )}

          {p.bio && <p className="text-[14px] leading-relaxed text-fg-2">{p.bio}</p>}

          {p.trips.length > 0 && (
            <p className="rounded-input border border-line-2 px-3 py-2 text-[12px] text-fg-2">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="mr-1 inline-block align-[-3px]"><path d={MAP_ICON_PATHS.plane} /></svg>{' '}
              {p.trips
                .map(
                  (t) =>
                    `${t.city.split(',')[0]} · ${tripText(t)} (${t.nights} night${t.nights === 1 ? '' : 's'})`,
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
              onClick={interest}
              disabled={busy === 'interest' || signalled}
              aria-pressed={signalled}
              className="btn-secondary h-12"
            >
              {signalled ? 'Interested · sent' : busy === 'interest' ? '…' : 'Interested'}
            </button>
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
      {reveal && <MutualReveal name={reveal} onClose={() => setReveal(null)} />}
    </Sheet>
  );
}
