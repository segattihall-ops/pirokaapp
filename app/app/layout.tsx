import { Rail, TabBar } from '@/components/app-nav';

/**
 * App shell: 80px rail on desktop (≥820px), 66px bottom tab bar on mobile.
 * Children fill the remaining viewport; each tab decides its own scroll behavior.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-ink-950">
      <Rail />
      <TabBar />
      <main className="min-h-dvh pb-[calc(66px+var(--safe-bottom))] rail:pb-0 rail:pl-rail">{children}</main>
    </div>
  );
}
