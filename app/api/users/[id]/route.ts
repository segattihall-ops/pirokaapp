import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { haveConversation, isBlocked } from '@/lib/chat/server';
import { photoUrl } from '@/lib/upload/storage';

export const dynamic = 'force-dynamic';

/** Public profile as another member sees it. Album photos stay blurred until an album grant exists. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const id = params.id;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  if (id !== session.userId && (await isBlocked(session.userId, id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [{ data: u }, { data: photos }, { data: status }, { data: grant }, conversation] = await Promise.all([
    supabaseAdmin
      .from('users')
      .select('id, handle, pronouns, gender, orientation, communities, bio, verified_at, plan, visibility, deleted_at, mod_step')
      .eq('id', id)
      .maybeSingle(),
    supabaseAdmin.from('photos').select('slot, storage_key, blur_key').eq('user_id', id).order('slot'),
    supabaseAdmin.from('statuses').select('intent, ends_at').eq('user_id', id).gt('ends_at', new Date().toISOString()).maybeSingle(),
    supabaseAdmin
      .from('album_grants')
      .select('granted_at')
      .eq('owner_id', id)
      .eq('grantee_id', session.userId)
      .is('revoked_at', null)
      .maybeSingle(),
    haveConversation(session.userId, id),
  ]);

  if (!u || u.deleted_at || (u.mod_step && ['suspended', 'removed'].includes(u.mod_step))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const self = id === session.userId;
  const unlocked = self || Boolean(grant);
  return NextResponse.json({
    id: u.id,
    handle: u.handle,
    pronouns: u.pronouns ?? [],
    gender: u.gender ?? [],
    orientation: u.orientation ?? [],
    communities: u.communities ?? [],
    bio: u.bio ?? null,
    verified: Boolean(u.verified_at),
    plan: u.plan,
    intent: status?.intent ?? null,
    intentEndsAt: status?.ends_at ?? null,
    photos: (photos ?? []).map((p) => ({
      slot: p.slot,
      url: photoUrl(unlocked || p.slot === 0 ? (p.slot === 0 && !unlocked ? p.blur_key : p.storage_key) : p.blur_key),
      blurred: !unlocked,
    })),
    albumUnlocked: unlocked,
    conversation,
  });
}
