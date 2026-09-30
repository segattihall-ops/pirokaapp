import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/server';
import { isAdmin } from '@/lib/auth/admin';
import { LogoTile } from '@/components/logo';

export const metadata: Metadata = { title: 'Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/?gate=1&next=%2Fadmin');
  if (!isAdmin(session)) redirect('/app/map');

  return (
    <div className="min-h-dvh bg-ink-950">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line-1 bg-ink-900/95 px-4 py-3 backdrop-blur-md sm:px-6">
        <Link href="/app/map" aria-label="Back to app">
          <LogoTile size={32} />
        </Link>
        <span className="eyebrow">Admin</span>
        <span className="ml-auto truncate text-[12px] text-fg-3">{session.email ?? session.userId}</span>
      </header>
      <main className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
