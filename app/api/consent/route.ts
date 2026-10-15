import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession, updateGate } from '@/lib/auth/server';
import { track } from '@/lib/analytics/server';
import { EVENTS } from '@/lib/analytics/events';

export const dynamic = 'force-dynamic';

const Body = z.object({ age18: z.literal(true), terms: z.literal(true) });

/** Records the two required confirmations (18+, Terms/Privacy/Guidelines). Both must be true. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: 'Both confirmations are required' }, { status: 400 });
  const first = !session.consentAt;
  const next = await updateGate(session, { consentAt: new Date().toISOString() });
  // First consent is the closest thing to "account created" the app sees.
  if (first)
    void track({
      userId: session.userId,
      event: EVENTS.signup,
      props: { provider: session.provider, anonymous: session.anonymous },
    });
  return NextResponse.json({ session: next });
}
