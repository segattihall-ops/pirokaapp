'use client';

import { intentMeta, timeLeft } from '@/lib/geo/client';

export type CardUser = {
  id: string;
  handle: string | null;
  photo: string | null;
  verified: boolean;
  intent?: string | null;
  intentEndsAt?: string | null;
};

export function Avatar({ user, size = 44 }: { user: Pick<CardUser, 'handle' | 'photo'>; size?: number }) {
  return (
    <span className="relative shrink-0 overflow-hidden rounded-[12px] bg-ink-800" style={{ width: size, height: size }}>
      {user.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.photo} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[16px] font-bold text-fg-3">
          {(user.handle ?? '?').slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
}

/** One person in a list: blurred avatar, handle, live intent, plus whatever actions the caller passes. */
export function UserRow({
  user,
  sub,
  onOpen,
  children,
}: {
  user: CardUser;
  sub?: string;
  onOpen?: () => void;
  children?: React.ReactNode;
}) {
  const meta = intentMeta(user.intent);
  const name = user.handle ? `@${user.handle}` : 'Anonymous';
  const body = (
    <>
      <Avatar user={user} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[14px] font-medium">
          <span className="truncate">{name}</span>
          {user.verified && <span className="text-[11px] font-bold text-green">✓</span>}
        </span>
        <span className="block truncate text-[12px] text-fg-3">
          {meta ? (
            <>
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: meta.color }} />
              {meta.label} · {timeLeft(user.intentEndsAt)}
            </>
          ) : (
            (sub ?? 'Not live')
          )}
        </span>
      </span>
    </>
  );
  return (
    <div className="flex items-center gap-3 border-t border-line-1 py-2.5 first:border-t-0">
      {onOpen ? (
        <button type="button" onClick={onOpen} className="tap-hit flex min-w-0 flex-1 items-center gap-3 rounded-[12px] text-left hover:bg-ink-850">
          {body}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{body}</div>
      )}
      {children}
    </div>
  );
}
