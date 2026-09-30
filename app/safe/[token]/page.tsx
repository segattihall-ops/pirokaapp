import type { Metadata } from 'next';
import { SafeStatus } from '@/components/meet/safe-status';

export const metadata: Metadata = { title: 'SafeMeet status', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/** Public page for a trusted contact. No sign-in; the token is the only key. */
export default function SafePage({ params }: { params: { token: string } }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col gap-4 px-4 py-8 sm:px-6">
      <span className="eyebrow">πroka · SafeMeet</span>
      <SafeStatus token={params.token} />
      <p className="mt-auto text-[12px] text-fg-4">
        This page was shared with you by the person meeting up. It shows only their check-in status. If you cannot reach them and they are overdue, contact local emergency services.
      </p>
    </main>
  );
}
