import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { DEMO_COOKIE, verifySession } from '@/lib/auth/demo-token';
import { sessionFromUser } from '@/lib/auth/session-from-user';
import { GATE_PATH } from '@/lib/auth/types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Routes that need a signed-in AND age-verified user. Everything else is public. */
const GATED = [/^\/app(\/|$)/, /^\/onboarding(\/|$)/];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const gated = GATED.some((r) => r.test(pathname));
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

  if (gated && !(signedIn && ageVerified)) {
    const url = req.nextUrl.clone();
    const [path, query] = GATE_PATH.split('?');
    url.pathname = path;
    url.search = query ? `?${query}&next=${encodeURIComponent(pathname)}` : '';
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|icon.svg|favicon.ico|.*\\.(?:png|jpg|svg|webp|ico)$).*)'],
};
