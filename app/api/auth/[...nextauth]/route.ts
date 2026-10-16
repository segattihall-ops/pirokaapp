import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Auth is Supabase (see lib/auth/server.ts and the sibling routes under /api/auth). This catch-all
 * used to hand every unknown /api/auth/* path to next-auth, which has no secret, no adapter and
 * no provider configured here: it answered 500 "[next-auth][error][NO_SECRET]" (/api/auth/providers,
 * production 2026-10-16 13:12Z) and left /api/auth/session hanging for the full 30 s function
 * timeout. A path that no auth route owns is simply not found.
 *
 * lib/auth/config.ts and the `next-auth` dependency are now unused and can be removed.
 */
function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export { notFound as GET, notFound as POST, notFound as PUT, notFound as DELETE, notFound as PATCH };
