import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { ageProvider, createPersonaInquiry } from '@/lib/age';
import { createDiditSession, needsIdRecheck } from '@/lib/age/didit';

export const dynamic = 'force-dynamic';

/**
 * Starts the age check for the signed-in user. The session/inquiry is created on the server, so
 * the browser can't choose its workflow or the user it is credited to. Requires consent first.
 */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (!session.consentAt) return NextResponse.json({ error: 'Consent is required first' }, { status: 409 });

  const provider = ageProvider();
  if (provider === 'didit') {
    const mode = (await needsIdRecheck(session.userId)) ? 'id' : 'standard';
    const result = await createDiditSession(session.userId, mode);
    if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 502 });
    return NextResponse.json({ provider, url: result.url, sessionId: result.sessionId, mode });
  }
  if (provider === 'persona') {
    const result = await createPersonaInquiry(session.userId);
    if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 502 });
    return NextResponse.json({ provider, inquiryId: result.inquiryId });
  }
  return NextResponse.json({ error: 'No age-verification provider configured' }, { status: 503 });
}
