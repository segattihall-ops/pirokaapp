import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser } from '@/lib/api/guard';
import { signOutServer } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

/**
 * Delete my account for good: photos in storage, every row that references me (cascades), then the auth user.
 * Reports and moderation actions about me stay, with the user reference cleared. Not reversible.
 */
export async function DELETE(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const me = g.session.userId;
  const db = supabaseAdmin!;

  const { confirm } = (await request.json().catch(() => ({}))) as { confirm?: unknown };
  if (confirm !== 'DELETE') return NextResponse.json({ error: 'Type DELETE to confirm' }, { status: 400 });

  // Storage: everything under users/<id>/
  const prefix = `users/${me}`;
  const { data: dirs } = await db.storage.from('photos').list(`${prefix}/photos`, { limit: 100 });
  const keys = (dirs ?? []).filter((f) => f.name).map((f) => `${prefix}/photos/${f.name}`);
  if (keys.length) await db.storage.from('photos').remove(keys).catch((e) => console.error('storage cleanup', e));

  // Rows: the users row cascades to photos, statuses, locations, favourites, trips, album, notifications,
  // push subscriptions, signal keys, conversations and messages.
  await db.from('audit_log').insert({ actor_id: me, action: 'account.delete', target: me });
  const { error } = await db.from('users').delete().eq('id', me);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { error: authErr } = await db.auth.admin.deleteUser(me);
  if (authErr) console.error('auth delete failed', authErr.message);

  await signOutServer().catch(() => {});
  return NextResponse.json({ ok: true });
}
