import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser } from '@/lib/api/guard';

export const dynamic = 'force-dynamic';

const CreateReferralCodeSchema = z.object({
  code: z.string().min(6).max(12).regex(/^[A-Z0-9]+$/),
  rewardCredits: z.number().int().min(10).max(10000).optional(),
  maxUses: z.number().int().min(1).optional(),
  expiresAt: z.string().datetime().optional(),
});

export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const userId = g.session.userId;

  try {
    const body = await request.json();
    const parsed = CreateReferralCodeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    }

    const { data, error } = await supabaseAdmin
      .from('referral_codes')
      .insert({
        user_id: userId,
        code: parsed.data.code.toUpperCase(),
        reward_credits: parsed.data.rewardCredits || 100,
        max_uses: parsed.data.maxUses,
        expires_at: parsed.data.expiresAt,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Code already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to create referral code' }, { status: 500 });
    }

    return NextResponse.json({ code: data });
  } catch (err) {
    console.error('referral code creation error:', err);
    return NextResponse.json({ error: 'Failed to create referral code' }, { status: 500 });
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

    const { data, error } = await supabaseAdmin
      .from('referral_codes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch referral codes' }, { status: 500 });
    }

    return NextResponse.json({ codes: data });
  } catch (err) {
    console.error('referral codes fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch referral codes' }, { status: 500 });
  }
}
