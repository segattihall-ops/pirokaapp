import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/guard';
import { isUuid } from '@/lib/api/guard';
import { withApi } from '@/lib/errors/server';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

/**
 * Revokes a user's 18+ status and demands an ID-document check (used when an account is reported
 * as underage). The user is locked out of the app until the ID-only Didit workflow approves them.
 */
export const POST = withApi('/api/admin/users/[id]/age-recheck', async (request: Request, { params }: Ctx) => {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  if (params.id === g.session.userId) return NextResponse.json({ error: 'Cannot re-check yourself' }, { status: 400 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const { reason } = (await request.json().catch(() => ({}))) as { reason?: string };
  const { error } = await admin.auth.admin.updateUserById(params.id, {
    app_metadata: { age_verified: false, age_method: null, age_recheck: true },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin?.from('audit_log').insert({
    actor_id: g.session.userId,
    action: 'age.recheck_required',
    target: params.id,
    target_user_id: params.id,
    details: { reason: reason?.slice(0, 300) ?? null },
  });
  return NextResponse.json({ ok: true });
});
