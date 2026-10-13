import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/server';
import { captureError } from '@/lib/errors/server';
import { clientIp, rateLimit, tooMany } from '@/lib/api/rate-limit';

export const dynamic = 'force-dynamic';

const Body = z.object({
  message: z.string().min(1).max(1000),
  stack: z.string().max(4000).optional(),
  path: z.string().max(200).optional(),
  extra: z.record(z.unknown()).optional(),
});

/** Browser errors land here. Deduped by fingerprint into error_events; the user is attached from the session. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!(await rateLimit(`errors:${session?.userId ?? clientIp(request)}`, 30, 60))) return tooMany();

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid report' }, { status: 400 });
  const b = parsed.data;
  const err = new Error(b.message);
  err.stack = b.stack ?? err.stack;
  const ref = await captureError(err, {
    source: 'client',
    route: b.path ? b.path.split('/').slice(0, 3).join('/') : undefined,
    userId: session?.userId ?? null,
    extra: b.extra,
  });
  return NextResponse.json({ ok: true, ref });
}
