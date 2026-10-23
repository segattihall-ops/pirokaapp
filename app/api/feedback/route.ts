import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { ensureUserRow } from '@/lib/db/users';
import { rateLimit, tooMany } from '@/lib/api/rate-limit';
import { track } from '@/lib/analytics/server';
import { EVENTS } from '@/lib/analytics/events';
import { opsAlert } from '@/lib/alerts/server';
import { appUrl } from '@/lib/app-url';
import { withApi } from '@/lib/errors/server';

export const dynamic = 'force-dynamic';

const Body = z.object({
  kind: z.enum(['bug', 'idea', 'other']).default('other'),
  message: z.string().trim().min(3).max(2000),
  path: z.string().max(200).optional(),
  email: z.string().email().optional(),
});

/** In-app "Send feedback". Signed-in only; 5 per hour. */
export const POST = withApi('/api/feedback', async (request: Request) => {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await rateLimit(`feedback:${session.userId}`, 5, 3600))) return tooMany();
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Write at least a few words' }, { status: 400 });
  const b = parsed.data;

  if (!supabaseAdmin) return NextResponse.json({ ok: true, demo: true });
  await ensureUserRow(session);
  const { data, error } = await supabaseAdmin
    .from('feedback')
    .insert({
      user_id: session.userId,
      email: b.email ?? session.email ?? null,
      kind: b.kind,
      message: b.message,
      path: b.path ?? null,
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  void track({ userId: session.userId, event: EVENTS.feedback_sent, props: { kind: b.kind } });
  await opsAlert(
    'feedback',
    `${b.kind} ${data.id}${b.path ? ` · ${b.path}` : ''} · ${appUrl('/admin/feedback')}`,
  );
  return NextResponse.json({ ok: true, id: data.id });
});
