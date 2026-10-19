import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'πroka for Partners' };
export const dynamic = 'force-dynamic';

/** Partner portal shell: no tab bar, no rail — venues, clinics and organizers only. */
export default function PartnersLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-ink-950 text-fg">{children}</div>;
}
