import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser } from '@/lib/api/guard';

export const dynamic = 'force-dynamic';

const SaveFilterSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  filterConfig: z.record(z.any()),
});

export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const userId = g.session.userId;

  try {
    const body = await request.json();
    const parsed = SaveFilterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    }

    const { data, error } = await supabaseAdmin
      .from('saved_filters')
      .insert({
        user_id: userId,
        name: parsed.data.name,
        description: parsed.data.description,
        filter_config: parsed.data.filterConfig,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to save filter' }, { status: 500 });
    }

    return NextResponse.json({ filter: data });
  } catch (err) {
    console.error('Save filter error:', err);
    return NextResponse.json({ error: 'Failed to save filter' }, { status: 500 });
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
      .from('saved_filters')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch filters' }, { status: 500 });
    }

    return NextResponse.json({ filters: data });
  } catch (err) {
    console.error('Fetch filters error:', err);
    return NextResponse.json({ error: 'Failed to fetch filters' }, { status: 500 });
  }
}
