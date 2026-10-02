import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';

const UnsubscribeSchema = z.object({
  email: z.string().email(),
  token: z.string(), // Simple token validation (could be JWT in production)
});

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = UnsubscribeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    }

    const { email, token } = parsed.data;

    // Verify token (in production, use JWT)
    // For now: accept any token (unsubscribe is not sensitive)

    // Find user by email
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (userError || !user) {
      // Don't reveal if email exists
      return NextResponse.json({ success: true, message: 'Unsubscribed' });
    }

    // Disable email notifications
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        email_notifications_enabled: false,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Unsubscribe error:', updateError);
      return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 });
    }

    // Log to audit trail
    await supabaseAdmin
      .from('audit_log')
      .insert({
        user_id: user.id,
        action: 'email_unsubscribe',
        details: { timestamp: new Date().toISOString() },
      })
      .catch((err) => console.error('Audit log error:', err));

    return NextResponse.json({ success: true, message: 'Unsubscribed successfully' });
  } catch (err) {
    console.error('Unsubscribe error:', err);
    return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 });
  }
}
