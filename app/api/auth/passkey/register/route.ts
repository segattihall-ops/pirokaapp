import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/api/guard';
import { ensureUserRow } from '@/lib/db/users';
import { rateLimit, tooMany } from '@/lib/api/rate-limit';
import { registrationOptions, verifyRegistration } from '@/lib/auth/passkeys';
import { supabaseAdmin } from '@/lib/db/client';
import { withApi } from '@/lib/errors/server';

export const dynamic = 'force-dynamic';

/** Step 1: options for navigator.credentials.create(). Signed-in users only. */
export const GET = withApi('/api/auth/passkey/register', async () => {
  const g = await requireUser();
  if (g.error) return g.error;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  if (!(await rateLimit(`passkey-reg:${g.session.userId}`, 10, 3600))) return tooMany();
  await ensureUserRow(g.session);
  const { data: me } = await supabaseAdmin.from('users').select('handle').eq('id', g.session.userId).maybeSingle();
  const label = me?.handle ? `@${me.handle}` : (g.session.email ?? 'πroka member');
  return NextResponse.json(await registrationOptions(g.session.userId, label));
});

const Body = z.object({
  challengeId: z.string().uuid(),
  response: z.record(z.unknown()),
  label: z.string().max(60).optional(),
});

/** Step 2: verify the new credential and store its public key. */
export const POST = withApi('/api/auth/passkey/register', async (request: Request) => {
  const g = await requireUser();
  if (g.error) return g.error;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const r = await verifyRegistration(
    g.session.userId,
    parsed.data.challengeId,
    parsed.data.response as never,
    parsed.data.label ?? null,
  );
  if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 });
  await supabaseAdmin.from('audit_log').insert({ actor_id: g.session.userId, action: 'passkey.added', target: g.session.userId });
  return NextResponse.json({ ok: true });
});
