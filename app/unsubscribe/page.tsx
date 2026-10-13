import type { Metadata } from 'next';
import Link from 'next/link';
import { LogoTile } from '@/components/logo';

export const metadata: Metadata = { title: 'Unsubscribe' };

/** Landing for email footers. The actual opt-out happens in /api/unsubscribe (GET link or one-click POST). */
export default function UnsubscribePage({ searchParams }: { searchParams: { token?: string; done?: string; error?: string } }) {
  const done = searchParams.done === '1';
  const error = searchParams.error === '1';
  const token = searchParams.token;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col items-center justify-center gap-5 px-4 py-10 text-center text-fg">
      <LogoTile size={48} />
      {done ? (
        <>
          <h1 className="text-h2">You’re unsubscribed</h1>
          <p className="text-[14px] text-fg-3">No more marketing email from πroka. You’ll still get receipts and safety notices about your account.</p>
        </>
      ) : error ? (
        <>
          <h1 className="text-h2">That link didn’t work</h1>
          <p className="text-[14px] text-fg-3">The unsubscribe link looks incomplete. You can also turn off marketing email from your profile.</p>
        </>
      ) : (
        <>
          <h1 className="text-h2">Stop marketing email?</h1>
          <p className="text-[14px] text-fg-3">Receipts and safety notices keep coming; everything else stops.</p>
          {token && (
            <form method="post" action="/api/unsubscribe">
              <input type="hidden" name="token" value={token} />
              <button type="submit" className="btn-primary">
                Unsubscribe
              </button>
            </form>
          )}
        </>
      )}
      <Link href="/app/me" className="tap-link text-[13px] text-fg-3 hover:text-green">
        Manage preferences in the app
      </Link>
    </div>
  );
}
