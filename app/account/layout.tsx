import { LogoTile, Wordmark } from '@/components/logo';
import Link from 'next/link';

/** Account flows: forgot password, magic link, reset. Content built in Phase 1 (Piroka Account.dc.html). */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-4 pt-[calc(16px+var(--safe-top))] sm:px-6">
      <header className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-3 rounded-logo">
          <LogoTile />
          <Wordmark />
        </Link>
      </header>
      <main className="glass mt-8 animate-in rounded-hero p-5 sm:p-7">{children}</main>
    </div>
  );
}
