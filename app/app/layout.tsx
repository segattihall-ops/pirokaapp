import { Rail, TabBar } from '@/components/app-nav';
import { SignalBootstrap } from '@/components/chat/signal-bootstrap';
import { BellDock } from '@/components/notifications/bell-dock';

/**
 * App shell: 80px rail on desktop (≥820px), 66px bottom tab bar on mobile.
 * Children fill the remaining viewport; each tab decides its own scroll behavior.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-ink-950">
      <SignalBootstrap />
      <Rail />
      <TabBar />
      <BellDock />
      <main className="min-h-dvh pb-[calc(66px+var(--safe-bottom))] rail:pb-0 rail:pl-rail">{children}</main>
    </div>
  );
}
