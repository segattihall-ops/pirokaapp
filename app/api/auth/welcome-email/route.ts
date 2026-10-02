import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/session';
import { sendWelcomeEmail } from '@/lib/email/resend';

export const dynamic = 'force-dynamic';

/**
 * Send welcome email after successful signup
 * Called from client-side after user account is created
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { email, name } = session.user;

    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 400 });
    }

    const result = await sendWelcomeEmail(email, name);

    if (result.success) {
      return NextResponse.json({ ok: true, emailId: result.id });
    } else {
      console.error('Welcome email failed:', result.error);
      // Don't fail signup if email fails
      return NextResponse.json({ ok: true, emailId: null, warning: 'Welcome email could not be sent' });
    }
  } catch (err) {
    console.error('Welcome email error:', err);
    // Don't fail signup if email fails
    return NextResponse.json({ ok: true, warning: 'Welcome email could not be sent' });
  }
}
