import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { requireAdmin } from '@/lib/admin/guard';
import { SEGMENTS, listCampaigns, segmentCount } from '@/lib/campaigns/server';
import { withApi } from '@/lib/errors/server';

export const dynamic = 'force-dynamic';

const Create = z.object({
  subject: z.string().trim().min(3).max(120),
  body: z.string().trim().min(10).max(10_000),
  segment: z.enum(SEGMENTS.map((s) => s.key) as [string, ...string[]]),
});

export const GET = withApi('/api/admin/campaigns', async () => {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  const campaigns = await listCampaigns();
  const counts = Object.fromEntries(await Promise.all(SEGMENTS.map(async (s) => [s.key, await segmentCount(s.key)])));
  return NextResponse.json({ campaigns, segments: SEGMENTS.map((s) => ({ ...s, count: counts[s.key] ?? 0 })) });
});

export const POST = withApi('/api/admin/campaigns', async (request: Request) => {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  const parsed = Create.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Subject (3–120), body (10+) and a segment are required' }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from('email_campaigns')
    .insert({ ...parsed.data, created_by: g.session.userId })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabaseAdmin.from('audit_log').insert({ actor_id: g.session.userId, action: 'campaign.create', target: data.id, details: { segment: data.segment } });
  return NextResponse.json({ campaign: data });
});
