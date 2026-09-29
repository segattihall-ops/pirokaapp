import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';

type ModStep = 'warn' | 'limit' | 'suspend' | 'remove';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return Response.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { userId, step, reason, ruleRef } = await request.json() as {
      userId: string;
      step: ModStep;
      reason: string;
      ruleRef: string;
    };

    if (!userId || !step || !reason) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const validSteps: ModStep[] = ['warn', 'limit', 'suspend', 'remove'];
    if (!validSteps.includes(step)) {
      return Response.json({ error: 'Invalid mod step' }, { status: 400 });
    }

    const user = await supabaseAdmin
      .from('users')
      .select('mod_step')
      .eq('id', userId)
      .single();

    if (user.error) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    await supabaseAdmin
      .from('users')
      .update({ mod_step: step })
      .eq('id', userId);

    await supabaseAdmin.from('audit_log').insert({
      moderator_id: session.userId,
      target_user_id: userId,
      action: `mod_${step}`,
      details: { reason, ruleRef },
      created_at: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      userId,
      step,
      modifiedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Moderation error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
