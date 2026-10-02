import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { getSession } from '@/lib/api/session';

const AgeVerifySchema = z.object({
  confirmedAge18Plus: z.boolean(),
});

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = AgeVerifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    if (!parsed.data.confirmedAge18Plus) {
      return NextResponse.json({ error: 'Age confirmation required' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    }

    // Record age verification in audit log
    const { error: auditError } = await supabaseAdmin
      .from('audit_log')
      .insert({
        user_id: session.user.id,
        action: 'age_verification',
        details: {
          method: 'self-declared',
          confirmed_at: new Date().toISOString(),
        },
      });

    if (auditError) {
      console.error('Audit log error:', auditError);
      // Don't fail the request for audit logging
    }

    // Update user profile with age_verified flag
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        age_verified: true,
        age_verified_at: new Date().toISOString(),
        age_verification_method: 'self-declared',
      })
      .eq('id', session.user.id);

    if (updateError) {
      console.error('Age verification update error:', updateError);
      return NextResponse.json({ error: 'Failed to record verification' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Age verified',
    });
  } catch (err) {
    console.error('Age verification error:', err);
    return NextResponse.json({ error: 'Failed to verify age' }, { status: 500 });
  }
}
