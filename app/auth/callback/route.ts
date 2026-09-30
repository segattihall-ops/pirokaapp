import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const OTP_TYPES: EmailOtpType[] = ['magiclink', 'recovery', 'signup', 'email', 'email_change', 'invite'];

/**
 * OAuth / magic-link return. Handles both the PKCE `code` and the `token_hash` form
 * (Supabase email templates: `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink`).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const nextRaw = url.searchParams.get('next') ?? '/';
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/';
  const sb = createClient();

  if (sb) {
    let error: { message: string } | null = null;
    if (code) ({ error } = await sb.auth.exchangeCodeForSession(code));
    else if (tokenHash && type && OTP_TYPES.includes(type)) {
      ({ error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type }));
    }
    if (error) return NextResponse.redirect(new URL(`/?auth_error=${encodeURIComponent(error.message)}`, url.origin));
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
