import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { ageProvider, createPersonaInquiry } from '@/lib/age';

export const dynamic = 'force-dynamic';

/**
 * Starts the age check for the signed-in user. Creates the inquiry on the server, so the browser
 * can't choose its reference or template. Requires consent first.
 */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (!session.consentAt) return NextResponse.json({ error: 'Consent is required first' }, { status: 409 });
  if (ageProvider() !== 'persona')
    return NextResponse.json({ error: 'No age-verification provider configured' }, { status: 503 });

  const result = await createPersonaInquiry(session.userId);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 502 });
  return NextResponse.json({ inquiryId: result.inquiryId });
}
