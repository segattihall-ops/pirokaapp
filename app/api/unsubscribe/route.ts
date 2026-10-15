import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe';
import { track } from '@/lib/analytics/server';
import { EVENTS } from '@/lib/analytics/events';
import { appUrl } from '@/lib/app-url';

export const dynamic = 'force-dynamic';

async function apply(token: string | null): Promise<boolean> {
  const userId = token && verifyUnsubscribeToken(token);
  if (!userId) return false;
  if (supabaseAdmin) {
    const { error } = await supabaseAdmin.from('users').update({ marketing_opt_out: true }).eq('id', userId);
    if (error) return false;
  }
  void track({ userId, event: EVENTS.email_unsubscribed });
  return true;
}

/** Link from the email footer: applies the opt-out and shows the confirmation page. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const ok = await apply(url.searchParams.get('token'));
  return NextResponse.redirect(appUrl(`/unsubscribe?${ok ? 'done=1' : 'error=1'}`), 303);
}

/** RFC 8058 one-click unsubscribe (List-Unsubscribe-Post) and the page's confirm button. */
export async function POST(request: Request) {
  const url = new URL(request.url);
  let token = url.searchParams.get('token');
  if (!token) {
    const form = await request.formData().catch(() => null);
    token = (form?.get('token') as string | null) ?? null;
  }
  const ok = await apply(token);
  const wantsHtml = (request.headers.get('accept') ?? '').includes('text/html');
  if (wantsHtml) return NextResponse.redirect(appUrl(`/unsubscribe?${ok ? 'done=1' : 'error=1'}`), 303);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
