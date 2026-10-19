import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/api/guard';
import { supabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

const Body = z.object({
  city: z.string().trim().min(1).max(120),
  hours: z.string().trim().max(40).optional(),
  why: z.string().trim().min(10).max(1000),
});

/** GET: the signed-in member's own ambassador status (or null). */
export async function GET() {
  const g = await requireUser();
  if (g.error) return g.error;
  if (!supabaseAdmin) return NextResponse.json({ ambassador: null });

  const { data } = await supabaseAdmin
    .from('ambassadors')
    .select('id, city, status, created_at')
    .eq('user_id', g.session.userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return NextResponse.json({ ambassador: data ?? null });
}

/** POST: apply to become an ambassador. One live application/role per member. */
export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Tell us your city and why.' }, { status: 400 });

  const { data: u } = await supabaseAdmin
    .from('users')
    .select('handle')
    .eq('id', g.session.userId)
    .maybeSingle();

  const { error } = await supabaseAdmin.from('ambassadors').insert({
    user_id: g.session.userId,
    handle: u?.handle ?? null,
    city: parsed.data.city,
    hours: parsed.data.hours ?? null,
    why: parsed.data.why,
    status: 'open',
  });
  if (error) {
    // Unique partial index → a live application/role already exists.
    if (error.code === '23505')
      return NextResponse.json({ error: 'You already have an application or role.' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
