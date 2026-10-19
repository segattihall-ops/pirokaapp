import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { clientIp, rateLimit, tooMany } from '@/lib/api/rate-limit';

export const dynamic = 'force-dynamic';

const Body = z.object({
  topic: z.string().trim().min(1).max(200),
  body: z.string().trim().min(2).max(2000),
  lang: z.enum(['EN', 'PT', 'ES']).default('EN'),
  email: z.string().trim().email().max(200).optional().or(z.literal('')),
});

/**
 * Opens a support ticket from the Help "talk to a person" helper. No account required — a guest can
 * leave an email to be reached. The ticket lands in the admin Support queue. Only 503 when there is
 * no database, so we never pretend a ticket was opened.
 */
export async function POST(request: Request) {
  if (!(await rateLimit(`support:${clientIp(request)}`, 6, 3600))) return tooMany();

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Tell us what is going on.' }, { status: 400 });
  if (!supabaseAdmin)
    return NextResponse.json({ error: 'Support is temporarily unavailable.' }, { status: 503 });

  const { topic, body, lang, email } = parsed.data;
  const session = await getSession().catch(() => null);

  let handle: string | null = null;
  let plan: string | null = null;
  if (session?.userId) {
    const { data: u } = await supabaseAdmin
      .from('users')
      .select('handle, plan')
      .eq('id', session.userId)
      .maybeSingle();
    handle = u?.handle ?? null;
    plan = u?.plan ?? 'free';
  }

  const { data, error } = await supabaseAdmin
    .from('support_tickets')
    .insert({
      user_id: session?.userId ?? null,
      handle,
      email: email || null,
      topic: topic.slice(0, 200),
      lang,
      body,
      plan,
      status: 'open',
    })
    .select('id')
    .single();
  if (error || !data) {
    console.error('support ticket insert failed', error);
    return NextResponse.json({ error: 'Support is temporarily unavailable.' }, { status: 503 });
  }
  return NextResponse.json({ id: data.id });
}
