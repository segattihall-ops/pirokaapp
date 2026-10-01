import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser } from '@/lib/api/guard';

export const dynamic = 'force-dynamic';

const ShareSchema = z.object({
  granteeId: z.string().uuid(),
});

export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const userId = g.session.userId;

  try {
    const body = await request.json();
    const parsed = ShareSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

    const { granteeId } = parsed.data;
    if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

    // Check that user has a verified health card
    const { data: card, error: cardError } = await supabaseAdmin
      .from('health_cards')
      .select('status')
      .eq('user_id', userId)
      .single();

    if (cardError || !card || card.status !== 'verified') {
      return NextResponse.json({ error: 'Health card not verified' }, { status: 403 });
    }

    // Create share record
    const { data, error } = await supabaseAdmin
      .from('health_shares')
      .insert([{ owner_id: userId, grantee_id: granteeId }])
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ share: data }, { status: 201 });
  } catch (err) {
    console.error('health share error:', err);
    return NextResponse.json({ error: 'Failed to share health status' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const userId = g.session.userId;

  try {
    if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

    const { data, error } = await supabaseAdmin
      .from('health_shares')
      .select('owner_id, grantee_id, shared_at')
      .or(`owner_id.eq.${userId},grantee_id.eq.${userId}`)
      .order('shared_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Separate shares I own and shares granted to me
    const owned = data.filter((s: any) => s.owner_id === userId);
    const granted = data.filter((s: any) => s.grantee_id === userId);

    return NextResponse.json({ owned, granted });
  } catch (err) {
    console.error('health shares list error:', err);
    return NextResponse.json({ error: 'Failed to list shares' }, { status: 500 });
  }
}
