import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { requireAdmin } from '@/lib/admin/guard';
import { isUuid } from '@/lib/api/guard';
import { withApi } from '@/lib/errors/server';

export const dynamic = 'force-dynamic';

const Create = z.object({
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(2).max(600),
  url: z.string().trim().max(300).optional().nullable(),
  audience: z.enum(['all', 'free', 'paid']).default('all'),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional().nullable(),
});

export const GET = withApi('/api/admin/announcements', async () => {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  if (!supabaseAdmin) return NextResponse.json({ announcements: [] });
  const { data } = await supabaseAdmin.from('announcements').select('*').order('starts_at', { ascending: false }).limit(100);
  return NextResponse.json({ announcements: data ?? [] });
});

export const POST = withApi('/api/admin/announcements', async (request: Request) => {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  const parsed = Create.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Title (2–120) and body (2–600) are required' }, { status: 400 });
  const b = parsed.data;
  const url = b.url && /^(https?:\/\/|\/)/.test(b.url) ? b.url : null;
  const { data, error } = await supabaseAdmin
    .from('announcements')
    .insert({ title: b.title, body: b.body, url, audience: b.audience, starts_at: b.startsAt ?? new Date().toISOString(), ends_at: b.endsAt ?? null, created_by: g.session.userId })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabaseAdmin.from('audit_log').insert({ actor_id: g.session.userId, action: 'announcement.create', target: data.id, details: { audience: b.audience } });
  return NextResponse.json({ announcement: data });
});

export const DELETE = withApi('/api/admin/announcements', async (request: Request) => {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  const id = new URL(request.url).searchParams.get('id');
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  await supabaseAdmin.from('announcements').delete().eq('id', id);
  await supabaseAdmin.from('audit_log').insert({ actor_id: g.session.userId, action: 'announcement.delete', target: id });
  return NextResponse.json({ ok: true });
});
