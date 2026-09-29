import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** OAuth / magic-link return. Exchanges the PKCE code for a session, then continues to `next`. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const nextRaw = url.searchParams.get('next') ?? '/';
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/';
  const sb = createClient();
  if (code && sb) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error)
      return NextResponse.redirect(new URL(`/?auth_error=${encodeURIComponent(error.message)}`, url.origin));
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
