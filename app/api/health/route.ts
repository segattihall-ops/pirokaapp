import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser } from '@/lib/api/guard';
import { verifyTestResult } from '@/lib/ai/health-verify';

export const dynamic = 'force-dynamic';

const GetSchema = z.object({});

export async function GET(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const userId = g.session.userId;

  try {
    if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

    const { data: card, error } = await supabaseAdmin
      .from('health_cards')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: 'Failed to fetch health card' }, { status: 500 });
    }

    return NextResponse.json({ card: card || null });
  } catch (err) {
    console.error('health get error:', err);
    return NextResponse.json({ error: 'Failed to get health card' }, { status: 500 });
  }
}

const UploadSchema = z.object({
  imageBase64: z.string().min(100),
  testType: z.enum(['hiv', 'sti']),
  testDate: z.string(),
});

export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const userId = g.session.userId;

  try {
    const body = await request.json();
    const parsed = UploadSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

    const { imageBase64, testType, testDate } = parsed.data;
    if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

    // Verify test result with Claude vision
    const verification = await verifyTestResult(imageBase64, testType, testDate);

    // Create health card with verification status
    const testMonth = new Date(testDate).getMonth();
    const cardData = {
      user_id: userId,
      status: verification.confidence >= 0.8 ? 'verified' : 'pending',
      prevention: verification.prevention || [],
      visibility: 'private',
      verified_tests: [testType],
      ciphertext: null,
    };

    if (testType === 'hiv') {
      cardData[`${testType}_month`] = testMonth;
    } else if (testType === 'sti') {
      cardData[`${testType}_month`] = testMonth;
    }

    const { data, error } = await supabaseAdmin
      .from('health_cards')
      .upsert([cardData], { onConflict: 'user_id' })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Low-confidence results → verification queue
    if (verification.confidence < 0.8) {
      await supabaseAdmin.from('verifications').insert([
        {
          type: 'health_card',
          user_id: userId,
          data: { testType, testDate, confidence: verification.confidence, reason: verification.reason },
          status: 'pending',
        },
      ]);
    }

    return NextResponse.json({ card: data, verified: verification.confidence >= 0.8 });
  } catch (err) {
    console.error('health upload error:', err);
    return NextResponse.json({ error: 'Failed to upload health card' }, { status: 500 });
  }
}
