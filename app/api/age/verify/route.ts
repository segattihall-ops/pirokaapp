import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession, updateGate } from '@/lib/auth/server';
import { verifyAgeToken } from '@/lib/age';
import { recheckState } from '@/lib/age/didit';

export const dynamic = 'force-dynamic';

const Body = z.object({ method: z.enum(['face', 'id']), token: z.string().min(1).max(512) });

/**
 * Completes the age check. Requires a signed-in user who already gave consent.
 * Stores only `age_verified = true` (+ the method). No age, no image, no estimate.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (!session.consentAt) return NextResponse.json({ error: 'Consent is required first' }, { status: 409 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const result = await verifyAgeToken(parsed.data.method, parsed.data.token, session.userId);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 422 });

  // When an admin (or a protective hold) has demanded an ID re-check, this client path must not
  // accept a session the member already had: only the fresh ID session `/api/age/start` bound, and
  // only an approved ID-document step, may lift the hold. Otherwise a previously-approved selfie
  // could be replayed to clear a re-check opened after, e.g., an underage report.
  const recheck = await recheckState(session.userId);
  if (recheck.recheck && (result.method !== 'id' || parsed.data.token !== recheck.session)) {
    return NextResponse.json({ error: 'An ID document re-check is required' }, { status: 422 });
  }

  const next = await updateGate(session, { ageVerified: true, ageMethod: result.method });
  return NextResponse.json({ session: next });
}
