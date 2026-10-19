import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/api/guard';
import { supabaseAdmin } from '@/lib/db/client';
import { SIGNAL_WEIGHT, flagsFor, learnedWeights, traitLabel, type Signal } from '@/lib/taste/learn';
import { ensureUserRow } from '@/lib/db/users';
import { isMissingSchema, schemaPendingResponse } from '@/lib/db/schema-errors';
import { effectivePlanNow } from '@/lib/billing/launch';

export const dynamic = 'force-dynamic';

const SignalBody = z.object({
  userId: z.string().uuid(),
  kind: z.enum(['open', 'interest', 'chat', 'skip']),
});
const Flag = z.object({
  trait: z.string().min(3).max(80).regex(/^[a-z]+:[^\n]{1,60}$/),
  flag: z.enum(['like', 'avoid']),
});

/** Record a behaviour signal. Free members record too, so learning starts from day one. */
export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const parsed = SignalBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid signal' }, { status: 400 });
  const { userId, kind } = parsed.data;
  if (userId === g.session.userId) return NextResponse.json({ ok: true });
  await ensureUserRow(g.session);
  const { error } = await supabaseAdmin!.from('taste_events').insert({
    user_id: g.session.userId,
    target_id: userId,
    kind,
    weight: SIGNAL_WEIGHT[kind as Signal],
  });
  if (error) {
    if (isMissingSchema(error)) return NextResponse.json(schemaPendingResponse('020_phase13_taste_favorites'), { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** Premium: the learned traits, strongest first, with the member's ✓ / ✕ overrides. */
export async function GET() {
  const g = await requireUser();
  if (g.error) return g.error;
  const { data: me } = await supabaseAdmin!.from('users').select('plan').eq('id', g.session.userId).maybeSingle();
  if (effectivePlanNow(me?.plan) !== 'premium') return NextResponse.json({ locked: true, traits: [] });
  const [weights, flags] = await Promise.all([learnedWeights(g.session.userId), flagsFor(g.session.userId)]);
  const keys = new Set<string>([...weights.keys(), ...flags.keys()]);
  const traits = [...keys]
    .map((k) => ({
      key: k,
      label: traitLabel(k),
      weight: Math.round((weights.get(k) ?? 0) * 10) / 10,
      flag: flags.get(k) ?? null,
    }))
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight) || a.label.localeCompare(b.label))
    .slice(0, 40);
  return NextResponse.json({ locked: false, traits });
}

/** ✓ like / ✕ avoid on one trait. */
export async function PUT(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const parsed = Flag.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid trait' }, { status: 400 });
  const { error } = await supabaseAdmin!
    .from('taste_flags')
    .upsert({ user_id: g.session.userId, trait: parsed.data.trait, flag: parsed.data.flag }, { onConflict: 'user_id,trait' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Clear one trait's override (?trait=) or, without it, reset everything the model learned. */
export async function DELETE(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const trait = new URL(request.url).searchParams.get('trait');
  const db = supabaseAdmin!;
  if (trait) {
    await db.from('taste_flags').delete().eq('user_id', g.session.userId).eq('trait', trait);
  } else {
    await Promise.all([
      db.from('taste_flags').delete().eq('user_id', g.session.userId),
      db.from('taste_events').delete().eq('user_id', g.session.userId),
    ]);
  }
  return NextResponse.json({ ok: true });
}
