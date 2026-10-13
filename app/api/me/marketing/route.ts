import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { ensureUserRow } from '@/lib/db/users';

export const dynamic = 'force-dynamic';

/** Marketing email preference (receipts and safety notices are not affected). */
export async function GET() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ marketing: true });
  const { data } = await supabaseAdmin
    .from('users')
    .select('marketing_opt_out')
    .eq('id', session.userId)
    .maybeSingle();
  return NextResponse.json({ marketing: !data?.marketing_opt_out });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  const { marketing } = (await request.json().catch(() => ({}))) as { marketing?: unknown };
  if (typeof marketing !== 'boolean')
    return NextResponse.json({ error: 'marketing boolean required' }, { status: 400 });
  await ensureUserRow(session);
  const { error } = await supabaseAdmin
    .from('users')
    .update({ marketing_opt_out: !marketing })
    .eq('id', session.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ marketing });
}
