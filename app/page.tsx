import { HomeClient } from '@/components/home/home-client';
import { authMode } from '@/lib/auth/mode';

export const dynamic = 'force-dynamic';

/**
 * Homepage — live map background, chat sign-up, 18+ consent and face age check.
 * Spec: design_handoff/design/Piroka Homepage.dc.html. `?gate=1` means the visitor was
 * redirected here from a protected route and needs to finish the check-in.
 */
export default function HomePage({
  searchParams,
}: {
  searchParams: { gate?: string; auth_error?: string; error_description?: string; error?: string };
}) {
  // `auth_error` comes from /auth/callback; `error_description`/`error` when Supabase sends a
  // failed sign-in straight back to the Site URL.
  const authError = searchParams.auth_error || searchParams.error_description || searchParams.error || null;
  return <HomeClient gated={searchParams.gate === '1'} demo={authMode() === 'demo'} authError={authError} />;
}
