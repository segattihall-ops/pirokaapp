import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

const LeaderboardQuerySchema = z.object({
  metric: z.enum(['weekly_xp', 'referrals_count', 'messages_sent']).default('weekly_xp'),
  limit: z.number().int().min(1).max(100).default(50),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const metric = searchParams.get('metric') || 'weekly_xp';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    const parsed = LeaderboardQuerySchema.safeParse({ metric, limit });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    }

    // Get today's date and start of current week
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const today = weekStart.toISOString().split('T')[0];

    const { data, error } = await supabaseAdmin
      .from('leaderboard_snapshots')
      .select(
        `
        rank,
        total_xp,
        users (
          id,
          username,
          avatar_url
        )
      `
      )
      .eq('metric', parsed.data.metric)
      .eq('snapshot_date', today)
      .order('rank', { ascending: true })
      .limit(parsed.data.limit);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    }

    return NextResponse.json({
      metric: parsed.data.metric,
      date: today,
      entries: data,
    });
  } catch (err) {
    console.error('leaderboard fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}
