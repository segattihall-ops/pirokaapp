import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser } from '@/lib/api/guard';

export const dynamic = 'force-dynamic';

const RecordXPSchema = z.object({
  action: z.enum(['profile_complete', 'message_sent', 'photo_verified', 'referral_bonus']),
  amount: z.number().int().positive(),
  relatedId: z.string().uuid().optional(),
});

const XP_AMOUNTS: Record<string, number> = {
  profile_complete: 50,
  message_sent: 5,
  photo_verified: 25,
  referral_bonus: 100,
};

export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const userId = g.session.userId;

  try {
    const body = await request.json();
    const parsed = RecordXPSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    }

    const xpAmount = parsed.data.amount || XP_AMOUNTS[parsed.data.action] || 0;

    // Record XP
    const { data: xpRecord, error: xpError } = await supabaseAdmin
      .from('user_xp')
      .insert({
        user_id: userId,
        amount: xpAmount,
        action: parsed.data.action,
        related_id: parsed.data.relatedId,
      })
      .select()
      .single();

    if (xpError) {
      return NextResponse.json({ error: 'Failed to record XP' }, { status: 500 });
    }

    // Update user stats
    const { data: stats, error: statsError } = await supabaseAdmin
      .from('user_stats')
      .select('total_xp')
      .eq('user_id', userId)
      .single();

    if (statsError?.code === 'PGRST116') {
      // No existing stats, create
      await supabaseAdmin.from('user_stats').insert({
        user_id: userId,
        total_xp: xpAmount,
      });
    } else if (!statsError) {
      // Update existing
      await supabaseAdmin
        .from('user_stats')
        .update({ total_xp: (stats?.total_xp || 0) + xpAmount })
        .eq('user_id', userId);
    }

    return NextResponse.json({ xp: xpRecord, totalXP: (stats?.total_xp || 0) + xpAmount });
  } catch (err) {
    console.error('XP recording error:', err);
    return NextResponse.json({ error: 'Failed to record XP' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const userId = g.session.userId;

  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    }

    const { data: stats, error: statsError } = await supabaseAdmin
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (statsError) {
      return NextResponse.json({
        totalXP: 0,
        messagesSent: 0,
        photosVerified: 0,
        referralsCompleted: 0,
        conversationsCount: 0,
      });
    }

    return NextResponse.json({
      totalXP: stats.total_xp || 0,
      messagesSent: stats.messages_sent || 0,
      photosVerified: stats.photos_verified || 0,
      referralsCompleted: stats.referrals_completed || 0,
      conversationsCount: stats.conversations_count || 0,
    });
  } catch (err) {
    console.error('XP fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch XP' }, { status: 500 });
  }
}
