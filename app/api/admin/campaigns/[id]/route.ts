import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { requireAdmin } from '@/lib/admin/guard';
import { isUuid } from '@/lib/api/guard';
import { SEGMENTS, sendTest, type Campaign } from '@/lib/campaigns/server';
import { withApi } from '@/lib/errors/server';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

const Patch = z.object({
  subject: z.string().trim().min(3).max(120).optional(),
  body: z.string().trim().min(10).max(10_000).optional(),
  segment: z.enum(SEGMENTS.map((s) => s.key) as [string, ...string[]]).optional(),
  action: z.enum(['schedule', 'send_now', 'cancel', 'unschedule']).optional(),
  scheduledAt: z.string().datetime().optional(),
});

async function load(id: string): Promise<Campaign | null> {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin.from('email_campaigns').select('*').eq('id', id).maybeSingle();
  return (data as Campaign | null) ?? null;
}

/** Edit a draft, schedule / send now / cancel, or unschedule back to draft. */
export const PATCH = withApi('/api/admin/campaigns/[id]', async (request: Request, { params }: Ctx) => {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  const parsed = Patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const b = parsed.data;
  const c = await load(params.id);
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (b.subject || b.body || b.segment) {
    if (c.status !== 'draft' && c.status !== 'scheduled') return NextResponse.json({ error: 'Only drafts can be edited' }, { status: 409 });
    Object.assign(patch, { ...(b.subject && { subject: b.subject }), ...(b.body && { body: b.body }), ...(b.segment && { segment: b.segment }) });
  }
  if (b.action === 'schedule') {
    if (!b.scheduledAt) return NextResponse.json({ error: 'scheduledAt required' }, { status: 400 });
    if (c.status !== 'draft' && c.status !== 'scheduled') return NextResponse.json({ error: 'Campaign already sent' }, { status: 409 });
    Object.assign(patch, { status: 'scheduled', scheduled_at: b.scheduledAt });
  } else if (b.action === 'send_now') {
    if (c.status !== 'draft' && c.status !== 'scheduled') return NextResponse.json({ error: 'Campaign already sent' }, { status: 409 });
    Object.assign(patch, { status: 'scheduled', scheduled_at: new Date().toISOString() });
  } else if (b.action === 'unschedule') {
    if (c.status !== 'scheduled') return NextResponse.json({ error: 'Not scheduled' }, { status: 409 });
    Object.assign(patch, { status: 'draft', scheduled_at: null });
  } else if (b.action === 'cancel') {
    if (c.status === 'sent') return NextResponse.json({ error: 'Already sent' }, { status: 409 });
    Object.assign(patch, { status: 'cancelled', finished_at: new Date().toISOString() });
  }

  const { data, error } = await supabaseAdmin.from('email_campaigns').update(patch).eq('id', c.id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (b.action) {
    await supabaseAdmin.from('audit_log').insert({ actor_id: g.session.userId, action: `campaign.${b.action}`, target: c.id, details: { segment: data.segment } });
  }
  return NextResponse.json({ campaign: data });
});

/** Send a test copy to the signed-in admin (or a given address). */
export const POST = withApi('/api/admin/campaigns/[id]', async (request: Request, { params }: Ctx) => {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  const c = await load(params.id);
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { to } = (await request.json().catch(() => ({}))) as { to?: string };
  const target = (to ?? g.session.email ?? '').trim();
  if (!target) return NextResponse.json({ error: 'No address to send to' }, { status: 400 });
  const r = await sendTest(c, target, g.session.userId);
  return NextResponse.json({ ok: r.ok, status: r.status, provider: r.provider, error: r.error ?? null });
});

export const DELETE = withApi('/api/admin/campaigns/[id]', async (_request: Request, { params }: Ctx) => {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  const c = await load(params.id);
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (c.status === 'sending') return NextResponse.json({ error: 'Cancel it first' }, { status: 409 });
  await supabaseAdmin.from('email_campaigns').delete().eq('id', c.id);
  return NextResponse.json({ ok: true });
});
