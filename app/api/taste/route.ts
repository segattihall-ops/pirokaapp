import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser } from '@/lib/api/guard';

export const dynamic = 'force-dynamic';

const RecordTasteSchema = z.object({
  targetId: z.string().uuid(),
  action: z.enum(['like', 'pass', 'message']),
  confidence: z.number().min(0).max(1).optional(),
});

export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const userId = g.session.userId;

  try {
    const body = await request.json();
    const parsed = RecordTasteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    }

    const { targetId, action, confidence = 0.7 } = parsed.data;

    // Prevent self-targeting
    if (userId === targetId) {
      return NextResponse.json({ error: 'Cannot rate yourself' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('taste_vectors')
      .upsert([{ user_id: userId, target_id: targetId, action, confidence }], {
        onConflict: 'user_id,target_id,action',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to record preference' }, { status: 500 });
    }

    return NextResponse.json({ taste: data });
  } catch (err) {
    console.error('taste record error:', err);
    return NextResponse.json({ error: 'Failed to record taste preference' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const userId = g.session.userId;

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    }

    let query = supabaseAdmin.from('taste_vectors').select('*').eq('user_id', userId);

    if (action && ['like', 'pass', 'message'].includes(action)) {
      query = query.eq('action', action);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch taste vectors' }, { status: 500 });
    }

    return NextResponse.json({ vectors: data || [] });
  } catch (err) {
    console.error('taste fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch taste vectors' }, { status: 500 });
  }
}
