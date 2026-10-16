import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticationOptions, startSessionFor, verifyAuthentication } from '@/lib/auth/passkeys';
import { clientIp, rateLimit, tooMany } from '@/lib/api/rate-limit';
import { supabaseAdmin } from '@/lib/db/client';
import { track } from '@/lib/analytics/server';
import { withApi } from '@/lib/errors/server';

export const dynamic = 'force-dynamic';

/** Step 1: a one-time challenge for navigator.credentials.get(). No email needed (discoverable keys). */
export const GET = withApi('/api/auth/passkey/login', async (request: Request) => {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  if (!(await rateLimit(`passkey-login:${clientIp(request)}`, 30, 600))) return tooMany();
  return NextResponse.json(await authenticationOptions());
});

const Body = z.object({ challengeId: z.string().uuid(), response: z.record(z.unknown()) });

/** Step 2: verify the signature, then start a normal Supabase session in this response's cookies. */
export const POST = withApi('/api/auth/passkey/login', async (request: Request) => {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  if (!(await rateLimit(`passkey-login:${clientIp(request)}`, 30, 600))) return tooMany();
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const v = await verifyAuthentication(parsed.data.challengeId, parsed.data.response as never);
  if (!v.ok) return NextResponse.json({ error: v.reason }, { status: 401 });
  const s = await startSessionFor(v.userId);
  if (!s.ok) return NextResponse.json({ error: s.reason }, { status: 403 });

  void track({ userId: v.userId, event: 'signin', props: { method: 'passkey' } });
  return NextResponse.json({ ok: true });
});
