import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/guard';
import { supabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

/** The signed-in user's passkeys (no key material). */
export async function GET() {
  const g = await requireUser();
  if (g.error) return g.error;
  if (!supabaseAdmin) return NextResponse.json({ passkeys: [] });
  const { data } = await supabaseAdmin
    .from('passkeys')
    .select('id, label, device_type, backed_up, created_at, last_used_at')
    .eq('user_id', g.session.userId)
    .order('created_at');
  return NextResponse.json({ passkeys: data ?? [] });
}

/** Remove one passkey by id. */
export async function DELETE(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!/^[A-Za-z0-9_-]{8,512}$/.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  await supabaseAdmin.from('passkeys').delete().eq('id', id).eq('user_id', g.session.userId);
  await supabaseAdmin.from('audit_log').insert({ actor_id: g.session.userId, action: 'passkey.removed', target: g.session.userId });
  return NextResponse.json({ ok: true });
}
