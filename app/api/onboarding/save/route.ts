import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { ensureUserRow } from '@/lib/db/users';
import { alreadySent, sendEmail } from '@/lib/email';
import { templates } from '@/lib/email/templates';
import { track } from '@/lib/analytics/server';
import { EVENTS } from '@/lib/analytics/events';

export const dynamic = 'force-dynamic';

/** Welcome email, once per account; analytics for the funnel. Never blocks the response. */
async function afterOnboarding(userId: string, email: string | null, handle: string | null, anonymous: boolean) {
  await track({ userId, event: EVENTS.onboarding_completed, props: { anonymous, hasHandle: Boolean(handle) } });
  if (!email || anonymous) return;
  if (await alreadySent(userId, 'welcome')) return;
  await sendEmail({ to: email, userId, template: 'welcome', ...templates.welcome(handle) });
}

const tag = z.string().trim().min(1).max(40);
const Body = z.object({
  anonymous: z.boolean().default(false),
  displayName: z.string().trim().max(24).optional(),
  pronouns: z.array(tag).max(6).default([]),
  gender: z.array(tag).max(10).default([]),
  orientation: z.array(tag).max(10).default([]),
  communities: z.array(tag).max(20).default([]),
  showMe: z.array(tag).max(10).default([]),
  blurPhotos: z.boolean().default(true),
  verifiedOnly: z.boolean().default(false),
  strangerFilter: z.boolean().default(true),
  visibility: z.enum(['neighborhood', 'area', 'hidden']).default('neighborhood'),
  disguiseIcon: z.string().trim().max(24).default('piroka'),
  bio: z.string().trim().max(160).optional(),
});

/** Saves the onboarding profile. Anonymous members keep `handle` null and show as "Anonymous". */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid profile' }, { status: 400 });
  const b = parsed.data;

  const handle = b.anonymous ? null : (b.displayName ?? '').replace(/^@/, '');
  if (!b.anonymous && !/^[\w.-]{2,24}$/.test(handle ?? '')) {
    return NextResponse.json(
      { error: 'Pick a name of 2–24 letters, numbers, dots or dashes' },
      { status: 400 },
    );
  }
  // Demo mode (no Supabase keys): nothing to persist, but the flow must complete so every screen
  // can be exercised locally — see lib/auth/mode.ts.
  if (!supabaseAdmin) return NextResponse.json({ ok: true, handle, demo: true });

  await ensureUserRow(session);
  const { error } = await supabaseAdmin
    .from('users')
    .update({
      handle,
      pronouns: b.pronouns,
      gender: b.gender,
      orientation: b.orientation,
      communities: b.communities,
      show_me: b.showMe.includes('Everyone') ? [] : b.showMe,
      safety_prefs: {
        blurPhotos: b.blurPhotos,
        verifiedOnly: b.verifiedOnly,
        strangerFilter: b.strangerFilter,
      },
      visibility: b.visibility,
      disguise_icon: b.disguiseIcon,
      ...(b.bio !== undefined ? { bio: b.bio } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', session.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  afterOnboarding(session.userId, session.email, handle, b.anonymous).catch((e) => console.error('afterOnboarding', e));
  return NextResponse.json({ ok: true, handle });
}

export async function GET() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ profile: null });
  const { data } = await supabaseAdmin
    .from('users')
    .select(
      'handle, pronouns, gender, orientation, communities, show_me, safety_prefs, visibility, disguise_icon, bio',
    )
    .eq('id', session.userId)
    .maybeSingle();
  const { count } = await supabaseAdmin
    .from('photos')
    .select('slot', { count: 'exact', head: true })
    .eq('user_id', session.userId);
  return NextResponse.json({
    profile: data ?? null,
    photos: count ?? 0,
    complete: Boolean(data && (data.handle || data.gender?.length)),
  });
}
