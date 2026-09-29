import { HomeClient } from '@/components/home/home-client';
import { authMode } from '@/lib/auth/mode';

export const dynamic = 'force-dynamic';

/**
 * Homepage — live map background, chat sign-up, 18+ consent and face age check.
 * Spec: design_handoff/design/Piroka Homepage.dc.html. `?gate=1` means the visitor was
 * redirected here from a protected route and needs to finish the check-in.
 */
export default function HomePage({ searchParams }: { searchParams: { gate?: string } }) {
  return <HomeClient gated={searchParams.gate === '1'} demo={authMode() === 'demo'} />;
}
