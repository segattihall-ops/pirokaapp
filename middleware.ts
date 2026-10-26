import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { DEMO_COOKIE, verifySession } from '@/lib/auth/demo-token';
import { sessionFromUser } from '@/lib/auth/session-from-user';
import { GATE_PATH } from '@/lib/auth/types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Two-tier access (see docs/trust-safety/ACCESS_TIERS.md):
 *  - Tier 1 — signed in, no age check needed: the SFW "look around" surface. Anyone signed in
 *    (including an anonymous visitor) may browse the live map, places, events and profiles with
 *    photos kept blurred.
 *  - Tier 2 — signed in AND age-verified: participation. Chatting, posting, becoming visible on the
 *    map, albums, Meet Mode and converting to a real (Google/email) account all require the 18+
 *    check. Explicit photos are never served to strangers regardless (privacy blur in the profile
 *    API), so posting — not browsing — is what the age gate protects.
 */
/** Pages that need a signed-in AND age-verified user. */
const GATED_VERIFIED = [/^\/onboarding(\/|$)/, /^\/admin(\/|$)/, /^\/partners(\/|$)/];
/** Pages that only need a signed-in user (the SFW app shell). */
const GATED_SIGNED_IN = [/^\/app(\/|$)/];

/**
 * API routes a signed-in but not-yet-verified member may call: the gate itself, auth, telemetry,
 * public intake, account hygiene, webhooks and jobs. Every other /api/* route answers 403 until the
 * age check passes, so the 18+ rule holds for direct API calls, not just for pages.
 */
const API_PREGATE = [
  '/api/auth',
  '/api/consent',
  '/api/age',
  '/api/analytics',
  '/api/errors',
  '/api/help',
  '/api/status',
  '/api/piroka',
  '/api/announcements',
  '/api/flags',
  '/api/feedback',
  '/api/unsubscribe',
  '/api/webhooks',
  '/api/cron',
  '/api/safe',
  '/api/push',
  '/api/me/account',
  '/api/me/export',
  '/api/me/security',
  '/api/me/language',
  '/api/me/marketing',
];
/**
 * SFW browse reads (GET only) that power the un-verified "look around" surface. Writes and
 * participation actions under these same prefixes (e.g. POST /api/places/[id]/vote, POST
 * /api/area/messages) are NOT listed, so they fall through to the age gate. Profiles come back
 * with photos already blurred for strangers, so reading one reveals nothing explicit.
 */
const API_SFW_READ = [
  '/api/nearby',
  '/api/places',
  '/api/events',
  '/api/pulse',
  '/api/leaderboard',
  '/api/users',
  '/api/search',
  '/api/geocode',
  '/api/testing-sites',
  '/api/taste',
  '/api/area/messages',
];
const matchPrefix = (list: string[], p: string) => list.some((x) => p === x || p.startsWith(`${x}/`));
const apiPreGate = (p: string) => matchPrefix(API_PREGATE, p);
const apiSfwRead = (p: string, method: string) => method === 'GET' && matchPrefix(API_SFW_READ, p);
/** True when a signed-in but un-verified member is allowed to call this API route. */
const apiAllowedUnverified = (p: string, method: string) => apiPreGate(p) || apiSfwRead(p, method);

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // Supabase ignores a `redirectTo` that isn't on its Redirect URL allow-list and sends the
  // browser to the Site URL (the homepage) instead, so the OAuth/PKCE `code` lands on `/`
  // where nothing exchanges it and the visitor just sees the welcome screen again.
  // Hand that code to the callback route, which exchanges it and resumes the gate.
  const code = searchParams.get('code');
  if (pathname === '/' && code) {
    const url = req.nextUrl.clone();
    url.pathname = '/auth/callback';
    url.search = `?code=${encodeURIComponent(code)}&next=%2F`;
    return NextResponse.redirect(url);
  }

  const needVerified = GATED_VERIFIED.some((r) => r.test(pathname));
  const needSignedIn = GATED_SIGNED_IN.some((r) => r.test(pathname));
  let res = NextResponse.next({ request: req });

  let ageVerified = false;
  let signedIn = false;

  if (SUPABASE_URL && SUPABASE_KEY) {
    // Refresh the Supabase session cookie on every request (required by @supabase/ssr).
    const sb = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (all: { name: string; value: string; options: CookieOptions }[]) => {
          all.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          all.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    });
    const { data } = await sb.auth.getUser();
    if (data.user) {
      signedIn = true;
      ageVerified = sessionFromUser(data.user).ageVerified;
    }
  } else {
    const s = await verifySession(req.cookies.get(DEMO_COOKIE)?.value);
    signedIn = Boolean(s);
    ageVerified = Boolean(s?.ageVerified);
  }

  if (
    pathname.startsWith('/api/') &&
    signedIn &&
    !ageVerified &&
    !apiAllowedUnverified(pathname, req.method)
  ) {
    return NextResponse.json({ error: 'Age verification required', gate: GATE_PATH }, { status: 403 });
  }

  // Tier 2 pages need the age check; the SFW app shell only needs a signed-in user (an anonymous
  // visitor counts). Either way, a visitor who isn't signed in at all is sent to the gate.
  const blocked = needVerified ? !(signedIn && ageVerified) : needSignedIn && !signedIn;
  if (blocked) {
    const url = req.nextUrl.clone();
    const [path, query] = GATE_PATH.split('?');
    url.pathname = path;
    url.search = query ? `?${query}&next=${encodeURIComponent(pathname)}` : '';
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: [
    // Match all request paths except for the ones starting with:
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - icon.svg, favicon.ico, sw.js (static files)
    // - images and other media
    '/((?!_next/static|_next/image|icon.svg|favicon.ico|sw.js|.*\\.(?:png|jpg|svg|webp|ico)$).*)',
  ],
};
