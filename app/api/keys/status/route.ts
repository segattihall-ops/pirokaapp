import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ configured: false, published: false, oneTimeCount: 0 });

  const [{ data: identity }, { count }] = await Promise.all([
    supabaseAdmin
      .from('signal_identities')
      .select('identity_key, signed_prekey_id, updated_at')
      .eq('user_id', session.userId)
      .maybeSingle(),
    supabaseAdmin
      .from('signal_one_time_prekeys')
      .select('key_id', { count: 'exact', head: true })
      .eq('user_id', session.userId),
  ]);

  return NextResponse.json({
    configured: true,
    published: Boolean(identity),
    identityKey: identity?.identity_key ?? null,
    signedPreKeyId: identity?.signed_prekey_id ?? null,
    oneTimeCount: count ?? 0,
  });
}
