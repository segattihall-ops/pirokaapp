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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/users/${userId}`, { cache: 'no-store' })
      .then(async (r) => (r.ok ? setP(await r.json()) : setErr((await r.json().catch(() => ({}))).error ?? 'Not found')))
      .catch(() => setErr('Could not load profile'));
  }, [userId]);

  const message = async () => {
    setBusy(true);
    const r = await fetch('/api/chat/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(j.error ?? 'Could not start chat');
    router.push(`/app/chats/${j.id}`);
  };

  const meta = intentMeta(p?.intent);
  const main = p?.photos.find((x) => x.slot === 0);

  return (
    <Sheet onClose={onClose}>
      {err && !p ? (
        <p className="py-6 text-center text-[13px] text-fg-3">{err}</p>
      ) : !p ? (
        <p className="py-6 text-center text-[13px] text-fg-3">Loading…</p>
      ) : (
        <>
          <div className="flex items-start gap-4">
            <div className="relative h-[92px] w-[92px] shrink-0 overflow-hidden rounded-card bg-ink-800">
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
                  blurred
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-[20px] font-semibold tracking-[-0.02em]">{p.handle ? `@${p.handle}` : 'Anonymous'}</h2>
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
            <SafetyMenu peerUserId={p.id} peerHandle={p.handle} onBlocked={onClose} />
          </div>

          {p.bio && <p className="text-[14px] leading-relaxed text-fg-2">{p.bio}</p>}

          {p.communities.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {p.communities.map((c) => (
                <span key={c} className="rounded-chip border border-line-2 px-2.5 py-1 text-[12px] text-fg-2">
                  {c}
                </span>
              ))}
            </div>
          )}

          {p.photos.length > 1 && (
            <div className="grid grid-cols-5 gap-1.5">
              {p.photos
                .filter((x) => x.slot > 0)
                .map((x) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={x.slot} src={x.url} alt="" className="aspect-square w-full rounded-[10px] object-cover" />
                ))}
            </div>
          )}

          {err && (
            <p role="alert" className="text-[12px] text-danger">
              {err}
            </p>
          )}
          <button type="button" onClick={message} disabled={busy} className="btn-primary h-12 bg-green hover:bg-green-hover">
            {busy ? '…' : p.conversation ? 'Open chat' : 'Message'}
          </button>
          <p className="text-center text-[11px] text-fg-4">Messages are end-to-end encrypted.</p>
        </>
      )}
    </Sheet>
  );
}
