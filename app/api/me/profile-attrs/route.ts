import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser } from '@/lib/api/guard';

export const dynamic = 'force-dynamic';

const UpdateProfileAttrsSchema = z.object({
  positionMarks: z.array(z.enum(['top', 'versatile', 'bottom'])).optional(),
  ethnicity: z.array(z.string()).optional(),
});

export async function PATCH(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const userId = g.session.userId;

  try {
    const body = await request.json();
    const parsed = UpdateProfileAttrsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    }

    const updateData: Record<string, any> = {};
    if (parsed.data.positionMarks !== undefined) {
      updateData.position_marks = parsed.data.positionMarks;
    }
    if (parsed.data.ethnicity !== undefined) {
      updateData.ethnicity = parsed.data.ethnicity;
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    return NextResponse.json({ user: data });
  } catch (err) {
    console.error('profile attrs update error:', err);
    return NextResponse.json({ error: 'Failed to update profile attributes' }, { status: 500 });
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
      .select('position_marks, ethnicity')
      .eq('id', userId)
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch profile attributes' }, { status: 500 });
    }

    return NextResponse.json({
      positionMarks: data.position_marks || [],
      ethnicity: data.ethnicity || [],
    });
  } catch (err) {
    console.error('profile attrs fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch profile attributes' }, { status: 500 });
  }
}
