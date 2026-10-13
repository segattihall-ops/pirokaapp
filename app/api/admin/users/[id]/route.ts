import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { requireAdmin } from '@/lib/admin/guard';
import { isUuid } from '@/lib/api/guard';
import { withApi } from '@/lib/errors/server';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

/** Everything an admin needs about one account on one screen. Never includes location, photos or message content. */
export const GET = withApi('/api/admin/users/[id]', async (_request: Request, { params }: Ctx) => {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  const db = supabaseAdmin;
  const id = params.id;

  const [user, events, emails, payments, mods, reportsAbout, reportsBy] = await Promise.all([
    db
      .from('users')
      .select(
        'id, handle, email, plan, subscription_status, paypal_subscription_id, mod_step, age_verified, verified_at, created_at, last_seen_at, deleted_at, marketing_opt_out, auth_provider, visibility, cancelled_at, payment_failed_at',
      )
      .eq('id', id)
      .maybeSingle(),
    db
      .from('analytics_events')
      .select('event, props, path, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(25),
    db
      .from('email_log')
      .select('template, subject, status, provider, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(15),
    db
      .from('payments')
      .select('payment_id, amount, currency, status, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(15),
    db
      .from('mod_actions')
      .select('id, step, reason, rule_ref, expires_at, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
    db.from('reports').select('id', { count: 'exact', head: true }).eq('target_id', id),
    db.from('reports').select('id', { count: 'exact', head: true }).eq('reporter_id', id),
  ]);
  if (!user.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    user: user.data,
    events: events.data ?? [],
    emails: emails.data ?? [],
    payments: payments.data ?? [],
    modActions: mods.data ?? [],
    reports: { about: reportsAbout.count ?? 0, filed: reportsBy.count ?? 0 },
  });
});

const Patch = z.object({
  plan: z.enum(['free', 'plus', 'premium']).optional(),
  marketingOptOut: z.boolean().optional(),
  reason: z.string().trim().max(300).optional(),
});

/** Manual overrides: comp a plan, resolve a billing dispute, honour an opt-out request. Every change is audited. */
export const PATCH = withApi('/api/admin/users/[id]', async (request: Request, { params }: Ctx) => {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  const parsed = Patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const b = parsed.data;

  const patch: Record<string, unknown> = {};
  if (b.plan)
    Object.assign(patch, { plan: b.plan, subscription_status: b.plan === 'free' ? 'INACTIVE' : 'COMPED' });
  if (b.marketingOptOut !== undefined) patch.marketing_opt_out = b.marketingOptOut;
  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });

  const { error } = await supabaseAdmin.from('users').update(patch).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabaseAdmin.from('audit_log').insert({
    actor_id: g.session.userId,
    action: 'admin.user_update',
    target: params.id,
    target_user_id: params.id,
    details: { ...patch, reason: b.reason ?? null },
  });
  return NextResponse.json({ ok: true });
});
