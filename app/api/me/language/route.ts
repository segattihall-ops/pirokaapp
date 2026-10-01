import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser } from '@/lib/api/guard';

export const dynamic = 'force-dynamic';

const UpdateLanguageSchema = z.object({
  language: z.enum(['en', 'pt-BR', 'es']),
});

export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const userId = g.session.userId;

  try {
    const body = await request.json();
    const parsed = UpdateLanguageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    }

    const { language } = parsed.data;
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ language })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to update language' }, { status: 500 });
    }

    return NextResponse.json({ user: data });
  } catch (err) {
    console.error('language update error:', err);
    return NextResponse.json({ error: 'Failed to update language preference' }, { status: 500 });
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
      .from('users')
      .select('language')
      .eq('id', userId)
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch language' }, { status: 500 });
    }

    return NextResponse.json({ language: data.language || 'en' });
  } catch (err) {
    console.error('language fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch language preference' }, { status: 500 });
  }
}
