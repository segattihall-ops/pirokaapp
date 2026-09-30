import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { ensureUserRow } from '@/lib/db/users';

export const dynamic = 'force-dynamic';

const b64 = z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/);
const Body = z.object({
  identityKey: b64,
  signingKey: b64,
  signedPreKey: z.object({ id: z.number().int().positive(), publicKey: b64, signature: b64 }),
  oneTimePreKeys: z.array(z.object({ id: z.number().int().positive(), publicKey: b64 })).max(200).default([]),
});

/** Upload this device's public pre-key bundle. Private keys never leave the browser. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid bundle' }, { status: 400 });
  const b = parsed.data;

  await ensureUserRow(session);

  const { error } = await supabaseAdmin.from('signal_identities').upsert(
    {
      user_id: session.userId,
      identity_key: b.identityKey,
      signing_key: b.signingKey,
      signed_prekey_id: b.signedPreKey.id,
      signed_prekey: b.signedPreKey.publicKey,
      signed_prekey_sig: b.signedPreKey.signature,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (b.oneTimePreKeys.length) {
    const { error: e2 } = await supabaseAdmin.from('signal_one_time_prekeys').upsert(
      b.oneTimePreKeys.map((k) => ({ user_id: session.userId, key_id: k.id, public_key: k.publicKey })),
      { onConflict: 'user_id,key_id', ignoreDuplicates: true },
    );
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
  }

  const { count } = await supabaseAdmin
    .from('signal_one_time_prekeys')
    .select('key_id', { count: 'exact', head: true })
    .eq('user_id', session.userId);

  return NextResponse.json({ ok: true, oneTimeCount: count ?? 0 });
}
