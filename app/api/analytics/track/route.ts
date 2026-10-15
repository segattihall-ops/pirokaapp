import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { track } from '@/lib/analytics/server';
import { clientIp, rateLimit, tooMany } from '@/lib/api/rate-limit';

export const dynamic = 'force-dynamic';

const Body = z.object({
  event: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
  props: z.record(z.union([z.string().max(200), z.number(), z.boolean(), z.null()])).default({}),
  path: z.string().max(200).optional(),
  anonId: z.string().max(64).optional(),
});

/** Browser → server analytics sink. The session user is attached here, never trusted from the body. */
export async function POST(request: Request) {
  const session = await getSession();
  const who = session?.userId ?? clientIp(request);
  if (!(await rateLimit(`analytics:${who}`, 120, 60))) return tooMany();

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid event' }, { status: 400 });
  const b = parsed.data;
  await track({
    userId: session?.userId ?? null,
    anonId: session ? null : (b.anonId ?? null),
    event: b.event,
    props: b.props,
    path: b.path,
  });
  // Page views double as the presence heartbeat that lifecycle emails and the users browser read.
  if (session?.userId && b.event === 'page_view' && supabaseAdmin) {
    void supabaseAdmin
      .from('users')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', session.userId);
  }
  return NextResponse.json({ ok: true });
}
