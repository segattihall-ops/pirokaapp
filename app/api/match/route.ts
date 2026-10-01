import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser } from '@/lib/api/guard';

export const dynamic = 'force-dynamic';

const ComputeMatchSchema = z.object({
  targetId: z.string().uuid(),
});

// Simple match algorithm based on shared attributes
async function computeMatchScore(
  userId: string,
  targetId: string,
  supabase: typeof supabaseAdmin
): Promise<number> {
  if (!supabase) return 0;

  const { data: user } = await supabase
    .from('users')
    .select('gender,orientation,communities,show_me')
    .eq('id', userId)
    .single();

  const { data: target } = await supabase
    .from('users')
    .select('gender,orientation,communities,show_me')
    .eq('id', targetId)
    .single();

  if (!user || !target) return 0;

  let score = 0.5; // Base score

  // Gender compatibility
  if (user.show_me && user.show_me.length > 0) {
    if (user.show_me.some((g: string) => target.gender?.includes(g))) score += 0.15;
  }

  // Orientation compatibility
  if (user.orientation && target.orientation) {
    const overlap = user.orientation.filter((o: string) => target.orientation.includes(o));
    if (overlap.length > 0) score += 0.15;
  }

  // Shared communities
  if (user.communities && target.communities) {
    const overlap = user.communities.filter((c: string) => target.communities.includes(c));
    score += Math.min(0.2, overlap.length * 0.1);
  }

  return Math.min(1, score);
}

export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const userId = g.session.userId;

  try {
    const body = await request.json();
    const parsed = ComputeMatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    }

    const { targetId } = parsed.data;

    if (userId === targetId) {
      return NextResponse.json({ error: 'Cannot match with yourself' }, { status: 400 });
    }

    const score = await computeMatchScore(userId, targetId, supabaseAdmin);

    const { data, error } = await supabaseAdmin
      .from('match_scores')
      .upsert([{ user_id: userId, target_id: targetId, score }], {
        onConflict: 'user_id,target_id',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to compute match score' }, { status: 500 });
    }

    return NextResponse.json({ match: data });
  } catch (err) {
    console.error('match compute error:', err);
    return NextResponse.json({ error: 'Failed to compute match score' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const userId = g.session.userId;

  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    }

    const { data, error } = await supabaseAdmin
      .from('match_scores')
      .select('*')
      .eq('user_id', userId)
      .gt('score', 0.5)
      .order('score', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch match scores' }, { status: 500 });
    }

    return NextResponse.json({ matches: data || [] });
  } catch (err) {
    console.error('match fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch match scores' }, { status: 500 });
  }
}
