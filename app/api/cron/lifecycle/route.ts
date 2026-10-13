import { NextResponse } from 'next/server';
import { runLifecycle } from '@/lib/lifecycle/server';
import { withApi } from '@/lib/errors/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Daily: re-engagement, win-back and dunning emails. `Authorization: Bearer $CRON_SECRET`. */
export const GET = withApi('/api/cron/lifecycle', async (request: Request) => {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization') ?? '';
  if (!secret || auth !== `Bearer ${secret}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await runLifecycle();
  return NextResponse.json({ ok: true, ...result });
});
