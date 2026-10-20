import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/api/guard';
import { supabaseAdmin } from '@/lib/db/client';
import {
  createDiditPhotoSession,
  diditPhotoConfigured,
  evaluatePhotoDecision,
  fetchDiditDecision,
  markPhotoVerified,
} from '@/lib/age/didit';
import { photoUrl } from '@/lib/upload/storage';

export const dynamic = 'force-dynamic';

const SESSION = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const StartBody = z.object({ action: z.literal('start') });
const ConfirmBody = z.object({ action: z.literal('confirm'), sessionId: z.string().regex(SESSION) });
const Body = z.union([StartBody, ConfirmBody]);

/** The member's photo-verification state. `hasPhoto` gates the control — a face match needs a face. */
export async function GET() {
  const g = await requireUser();
  if (g.error) return g.error;
  if (!supabaseAdmin) return NextResponse.json({ photoVerified: false, hasPhoto: false, configured: false });

  const [{ data: me }, { data: photo }] = await Promise.all([
    supabaseAdmin.from('users').select('photo_verified').eq('id', g.session.userId).maybeSingle(),
    supabaseAdmin
      .from('photos')
      .select('storage_key')
      .eq('user_id', g.session.userId)
      .eq('slot', 0)
      .maybeSingle(),
  ]);
  return NextResponse.json({
    photoVerified: Boolean(me?.photo_verified),
    hasPhoto: Boolean(photo?.storage_key),
    configured: diditPhotoConfigured(),
  });
}

/**
 * Earn the photo badge. `start` opens a Didit selfie face-match against the member's own profile
 * photo; `confirm` (after Didit returns) grants the badge immediately when approved, so the member
 * doesn't wait on the webhook. The webhook remains the source of record either way.
 */
export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  if (!diditPhotoConfigured())
    return NextResponse.json({ error: 'Photo verification is not available yet.' }, { status: 503 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  if (parsed.data.action === 'start') {
    const { data: photo } = await supabaseAdmin
      .from('photos')
      .select('storage_key')
      .eq('user_id', g.session.userId)
      .eq('slot', 0)
      .maybeSingle();
    const portrait = await photoUrl(photo?.storage_key);
    if (!portrait)
      return NextResponse.json({ error: 'Add a profile photo first, then verify it.' }, { status: 409 });

    const r = await createDiditPhotoSession(g.session.userId, portrait);
    if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 502 });
    return NextResponse.json({ url: r.url, sessionId: r.sessionId });
  }

  // confirm: the user id is read from the trusted session, never the request.
  const decision = await fetchDiditDecision(parsed.data.sessionId);
  if (!evaluatePhotoDecision(decision, g.session.userId))
    return NextResponse.json({ error: 'Your photo check was not approved yet.' }, { status: 422 });
  if (!(await markPhotoVerified(g.session.userId)))
    return NextResponse.json({ error: 'Could not save your verification' }, { status: 500 });
  return NextResponse.json({ verified: true });
}
