import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireAdmin } from '@/lib/admin/guard';
import { withApi } from '@/lib/errors/server';

export const dynamic = 'force-dynamic';

const PLANS = ['free', 'plus', 'premium', 'anonymous'];
const COLS =
  'id, handle, email, plan, subscription_status, mod_step, age_verified, created_at, last_seen_at, deleted_at, marketing_opt_out, auth_provider';

/** Search users by handle / email / id with optional plan filter. */
export const GET = withApi('/api/admin/users', async (request: Request) => {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  if (!supabaseAdmin) return NextResponse.json({ users: [] });

  const p = new URL(request.url).searchParams;
  const q = (p.get('q') ?? '').trim().slice(0, 80);
  const plan = p.get('plan');
  const flag = p.get('flag'); // deleted | moderated | failed_payment
  let query = supabaseAdmin.from('users').select(COLS).order('created_at', { ascending: false }).limit(50);
  if (q) {
    if (/^[0-9a-f-]{36}$/i.test(q)) query = query.eq('id', q);
    else query = query.or(`handle.ilike.%${q.replace(/[%,]/g, '')}%,email.ilike.%${q.replace(/[%,]/g, '')}%`);
  }
  if (plan && PLANS.includes(plan)) query = query.eq('plan', plan);
  if (flag === 'deleted') query = query.not('deleted_at', 'is', null);
  else if (flag === 'moderated') query = query.not('mod_step', 'is', null);
  else if (flag === 'failed_payment') query = query.eq('subscription_status', 'PAYMENT_FAILED');
  else query = query.is('deleted_at', null);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data ?? [] });
});
