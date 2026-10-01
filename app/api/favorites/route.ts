import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser } from '@/lib/api/guard';

export const dynamic = 'force-dynamic';

const StarFavoriteSchema = z.object({
  favoriteId: z.string().uuid(),
});

export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const userId = g.session.userId;

  try {
    const body = await request.json();
    const parsed = StarFavoriteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    }

    const { favoriteId } = parsed.data;

    if (userId === favoriteId) {
      return NextResponse.json({ error: 'Cannot favorite yourself' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('favorites')
      .insert({ user_id: userId, favorite_id: favoriteId })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Already favorited' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to star favorite' }, { status: 500 });
    }

    return NextResponse.json({ favorite: data });
  } catch (err) {
    console.error('favorite star error:', err);
    return NextResponse.json({ error: 'Failed to star favorite' }, { status: 500 });
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
      .from('favorites')
      .select('*, favorite_profile:favorite_id(*)')
      .eq('user_id', userId)
      .order('starred_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch favorites' }, { status: 500 });
    }

    return NextResponse.json({ favorites: data || [] });
  } catch (err) {
    console.error('favorites fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch favorites' }, { status: 500 });
  }
}
