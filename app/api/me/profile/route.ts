import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser } from '@/lib/api/guard';
import { ensureUserRow } from '@/lib/db/users';
import { HANDLE_RE, photoLimit } from '@/lib/profile/options';
import { photoUrl } from '@/lib/upload/storage';

export const dynamic = 'force-dynamic';

const tag = z.string().trim().min(1).max(40);
const Patch = z
  .object({
    handle: z.string().trim().max(25).nullable(),
    pronouns: z.array(tag).max(6),
    gender: z.array(tag).max(10),
    orientation: z.array(tag).max(10),
    communities: z.array(tag).max(20),
    showMe: z.array(tag).max(10),
    bio: z.string().trim().max(160).nullable(),
    visibility: z.enum(['neighborhood', 'area', 'hidden']),
    disguiseIcon: z.string().trim().max(24),
    safetyPrefs: z
      .object({ blurPhotos: z.boolean(), verifiedOnly: z.boolean(), strangerFilter: z.boolean() })
      .partial(),
  })
  .partial();

/** My own profile as I edit it, with photo URLs (never blurred for the owner). */
export async function GET() {
  const g = await requireUser();
  if (g.error) return g.error;
  const me = g.session.userId;
  await ensureUserRow(g.session);

  const [{ data: u }, { data: photos }] = await Promise.all([
    supabaseAdmin!
      .from('users')
      .select(
        'handle, pronouns, gender, orientation, communities, show_me, bio, visibility, disguise_icon, safety_prefs, plan, auth_provider, verified_at, created_at',
      )
      .eq('id', me)
      .maybeSingle(),
    supabaseAdmin!.from('photos').select('slot, storage_key').eq('user_id', me).order('slot'),
  ]);
  if (!u) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    profile: {
      handle: u.handle,
      pronouns: u.pronouns ?? [],
      gender: u.gender ?? [],
      orientation: u.orientation ?? [],
      communities: u.communities ?? [],
      showMe: u.show_me?.length ? u.show_me : ['Everyone'],
      bio: u.bio ?? '',
      visibility: u.visibility,
      disguiseIcon: u.disguise_icon,
      safetyPrefs: {
        blurPhotos: true,
        verifiedOnly: false,
        strangerFilter: true,
        ...((u.safety_prefs as object) ?? {}),
      },
      plan: u.plan,
      verified: Boolean(u.verified_at),
      memberSince: u.created_at,
    },
    photos: (photos ?? []).map((p) => ({ slot: p.slot, url: `${photoUrl(p.storage_key)}?v=${Date.now()}` })),
    photoLimit: photoLimit(u.plan, u.auth_provider),
  });
}

/** Partial update. Handle must be unique (case-insensitive); null makes the profile anonymous. */
export async function PATCH(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const me = g.session.userId;
  const db = supabaseAdmin!;

  const parsed = Patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid profile' }, { status: 400 });
  const b = parsed.data;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (b.handle !== undefined) {
    const handle = b.handle === null || b.handle === '' ? null : b.handle.replace(/^@/, '');
    if (handle !== null && !HANDLE_RE.test(handle)) {
      return NextResponse.json(
        { error: 'Pick a name of 2–24 letters, numbers, dots or dashes' },
        { status: 400 },
      );
    }
    if (handle !== null) {
      const { data: taken } = await db
        .from('users')
        .select('id')
        .ilike('handle', handle)
        .neq('id', me)
        .is('deleted_at', null)
        .limit(1);
      if (taken?.length) return NextResponse.json({ error: 'That name is taken' }, { status: 409 });
    }
    patch.handle = handle;
  }
  if (b.pronouns) patch.pronouns = b.pronouns;
  if (b.gender) patch.gender = b.gender;
  if (b.orientation) patch.orientation = b.orientation;
  if (b.communities) patch.communities = b.communities;
  if (b.showMe) patch.show_me = b.showMe.includes('Everyone') ? [] : b.showMe;
  if (b.bio !== undefined) patch.bio = b.bio || null;
  if (b.visibility) patch.visibility = b.visibility;
  if (b.disguiseIcon) patch.disguise_icon = b.disguiseIcon;
  if (b.safetyPrefs) {
    const { data: cur } = await db.from('users').select('safety_prefs').eq('id', me).maybeSingle();
    patch.safety_prefs = {
      blurPhotos: true,
      verifiedOnly: false,
      strangerFilter: true,
      ...((cur?.safety_prefs as object) ?? {}),
      ...b.safetyPrefs,
    };
  }

  await ensureUserRow(g.session);
  const { error } = await db.from('users').update(patch).eq('id', me);
  if (error) {
    if (/idx_users_handle_lower|duplicate key/i.test(error.message))
      return NextResponse.json({ error: 'That name is taken' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, handle: patch.handle });
}
