import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/guard';
import { supabaseAdmin } from '@/lib/db/client';
import { ensureUserRow } from '@/lib/db/users';
import { notifyMany } from '@/lib/notify/server';
import { displayName, userCards } from '@/lib/users/cards';
import { track } from '@/lib/analytics/server';
import { DESPERATE_COOLDOWN_H, DESPERATE_MINUTES, type DesperateState } from '@/lib/desperate';
import { isMissingSchema, schemaPendingResponse } from '@/lib/db/schema-errors';
import { effectivePlanNow } from '@/lib/billing/launch';

export const dynamic = 'force-dynamic';

// Prototype rules: a 30-minute red alert to people nearby, once every 3 hours, Premium only.
const REACH_M = 2500;

async function stateFor(userId: string): Promise<DesperateState> {
  const db = supabaseAdmin!;
  const [{ data: u }, { data: d }] = await Promise.all([
    db.from('users').select('plan').eq('id', userId).maybeSingle(),
    db.from('desperate_alerts').select('until, sent_at, reached').eq('user_id', userId).maybeSingle(),
  ]);
  const now = Date.now();
  const until = d ? new Date(d.until).getTime() : 0;
  const nextAt = d ? new Date(d.sent_at).getTime() + DESPERATE_COOLDOWN_H * 3600_000 : 0;
  return {
    allowed: effectivePlanNow(u?.plan) === 'premium',
    active: d && until > now ? { until: d.until, reached: d.reached } : null,
    nextAt: nextAt > now ? new Date(nextAt).toISOString() : null,
  };
}

export async function GET() {
  const g = await requireUser();
  if (g.error) return g.error;
  return NextResponse.json(await stateFor(g.session.userId));
}

/** Body: { lat, lng } — the viewer's current fix, used only to find who to alert. Nothing is stored from it. */
export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const me = g.session.userId;
  const db = supabaseAdmin!;

  const state = await stateFor(me);
  if (!state.allowed)
    return NextResponse.json({ error: 'Desperate alerts are part of Premium.' }, { status: 403 });
  if (state.active)
    return NextResponse.json({ error: 'Your alert is already running.', ...state }, { status: 409 });
  if (state.nextAt) {
    const at = new Date(state.nextAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return NextResponse.json(
      { error: `You can send another desperate alert at ${at}.`, ...state },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { lat?: number; lng?: number };
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const hasFix = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

  await ensureUserRow(g.session);
  let nearby: string[] = [];
  if (hasFix) {
    const { data } = await db.rpc('nearby_users', {
      user_lat: lat,
      user_lon: lng,
      radius_m: REACH_M,
      requester_id: me,
      limit_count: 200,
    });
    nearby = ((data ?? []) as { id: string }[]).map((r) => r.id);
  }

  const now = new Date();
  const until = new Date(now.getTime() + DESPERATE_MINUTES * 60_000).toISOString();
  const { error } = await db
    .from('desperate_alerts')
    .upsert(
      { user_id: me, until, sent_at: now.toISOString(), reached: nearby.length },
      { onConflict: 'user_id' },
    );
  if (error) {
    // The table arrives with migration 035; say so instead of a generic failure.
    if (isMissingSchema(error))
      return NextResponse.json(schemaPendingResponse('035_app_v2_map'), { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  void track({ userId: me, event: 'desperate_sent', props: { reached: nearby.length } });
  if (nearby.length) {
    userCards([me])
      .then((cards) =>
        notifyMany(nearby, {
          kind: 'status',
          title: `${displayName(cards.get(me)?.handle)} is desperate`,
          body: `Nearby, for the next ${DESPERATE_MINUTES} minutes. Tap to open their profile.`,
          url: `/app/map?user=${me}`,
          refUser: me,
        }),
      )
      .catch((e) => console.error('desperate alerts failed', e));
  }
  return NextResponse.json({
    allowed: true,
    active: { until, reached: nearby.length },
    nextAt: new Date(now.getTime() + DESPERATE_COOLDOWN_H * 3600_000).toISOString(),
  } satisfies DesperateState);
}

/** Stop early. The cooldown still counts from when it was sent. */
export async function DELETE() {
  const g = await requireUser();
  if (g.error) return g.error;
  await supabaseAdmin!
    .from('desperate_alerts')
    .update({ until: new Date().toISOString() })
    .eq('user_id', g.session.userId);
  return NextResponse.json(await stateFor(g.session.userId));
}
