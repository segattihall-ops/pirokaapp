import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { haveConversation, isBlocked } from '@/lib/chat/server';

export const dynamic = 'force-dynamic';

/**
 * Fetch a peer's pre-key bundle to start a session. Consumes one of their one-time pre-keys,
 * so it is only allowed once a conversation exists between the two users (stops key draining).
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const userId = new URL(request.url).searchParams.get('userId');
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) return NextResponse.json({ error: 'userId required' }, { status: 400 });
  if (userId === session.userId) return NextResponse.json({ error: 'Cannot fetch own bundle' }, { status: 400 });

  if (await isBlocked(session.userId, userId)) return NextResponse.json({ error: 'Not available' }, { status: 403 });
  if (!(await haveConversation(session.userId, userId))) {
    return NextResponse.json({ error: 'Start a conversation first' }, { status: 403 });
  }

  const { data: identity } = await supabaseAdmin
    .from('signal_identities')
    .select('identity_key, signing_key, signed_prekey_id, signed_prekey, signed_prekey_sig')
    .eq('user_id', userId)
    .maybeSingle();
  if (!identity) return NextResponse.json({ error: 'This person has not set up encrypted chat yet' }, { status: 404 });

  const { data: opk } = await supabaseAdmin.rpc('claim_one_time_prekey', { target: userId });
  const one = Array.isArray(opk) && opk.length ? opk[0] : null;

  return NextResponse.json({
    userId,
    identityKey: identity.identity_key,
    signingKey: identity.signing_key,
    signedPreKey: {
      id: identity.signed_prekey_id,
      publicKey: identity.signed_prekey,
      signature: identity.signed_prekey_sig,
    },
    oneTimePreKey: one ? { id: one.key_id, publicKey: one.public_key } : null,
  });
}
