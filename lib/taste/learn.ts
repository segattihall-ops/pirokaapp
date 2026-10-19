import 'server-only';
import { supabaseAdmin } from '@/lib/db/client';

/**
 * "Your type" (FEATURES §4 / blueprint §6). Learns from behaviour, server-side only.
 *
 *  - Signals: open +1, interest +3, chat +2, skip −1 (taste_events).
 *  - Traits read from the TARGET: gender, orientation (identity), communities (interests),
 *    position marks, and current intent. Ethnicity and health are never traits.
 *  - Member overrides: ✓ like (+6) or ✕ avoid (−12) per trait (taste_flags).
 *  - Score: 50 + 50·tanh(Σ(weight·0.6 + flag) / 10), clamped to 1–99.
 *
 * Only Premium members get a score. Free members can record signals, but nothing is shown to them.
 */

export const SIGNAL_WEIGHT = { open: 1, interest: 3, chat: 2, skip: -1 } as const;
export type Signal = keyof typeof SIGNAL_WEIGHT;
const FLAG_BONUS = { like: 6, avoid: -12 } as const;

export type TraitKey = string; // "<dimension>:<value>", e.g. "position:top"

export function traitsOfTarget(u: {
  gender?: string[] | null;
  orientation?: string[] | null;
  communities?: string[] | null;
  position_marks?: string[] | null;
  intent?: string | null;
}): TraitKey[] {
  const out: TraitKey[] = [];
  for (const g of u.gender ?? []) out.push(`gender:${g}`);
  for (const o of u.orientation ?? []) out.push(`identity:${o}`);
  for (const c of u.communities ?? []) out.push(`interest:${c}`);
  for (const p of u.position_marks ?? []) out.push(`position:${p}`);
  if (u.intent) out.push(`intent:${u.intent}`);
  return out;
}

export const traitLabel = (key: TraitKey) => {
  const [dim, ...rest] = key.split(':');
  const value = rest.join(':');
  const dimLabel: Record<string, string> = {
    gender: 'Gender',
    identity: 'Identity',
    interest: 'Interest',
    position: 'Position',
    intent: 'Status',
  };
  return `${dimLabel[dim] ?? dim} · ${value}`;
};

/** Pure: the score for a target's traits given learned weights and flags. */
export function scoreFor(
  keys: TraitKey[],
  weights: Map<TraitKey, number>,
  flags: Map<TraitKey, 'like' | 'avoid'>,
): { score: number; reasons: string[] } {
  let sum = 0;
  const contributions: { key: TraitKey; c: number }[] = [];
  for (const k of keys) {
    const w = weights.get(k) ?? 0;
    const f = flags.get(k);
    const c = w * 0.6 + (f ? FLAG_BONUS[f] : 0);
    sum += c;
    if (c !== 0) contributions.push({ key: k, c });
  }
  const raw = 50 + 50 * Math.tanh(sum / 10);
  const score = Math.max(1, Math.min(99, Math.round(raw)));
  const reasons = contributions
    .filter((x) => x.c > 0)
    .sort((a, b) => b.c - a.c)
    .slice(0, 3)
    .map((x) => traitLabel(x.key));
  return { score, reasons };
}

/** Learned weights for a viewer, aggregated from their own signals against each target's traits. */
export async function learnedWeights(viewerId: string): Promise<Map<TraitKey, number>> {
  const weights = new Map<TraitKey, number>();
  if (!supabaseAdmin) return weights;
  const { data: events } = await supabaseAdmin
    .from('taste_events')
    .select('target_id, kind, weight')
    .eq('user_id', viewerId)
    .order('at', { ascending: false })
    .limit(500);
  const targetIds = [...new Set((events ?? []).map((e) => e.target_id as string))];
  if (!targetIds.length) return weights;
  const { data: targets } = await supabaseAdmin
    .from('users')
    .select('id, gender, orientation, communities, position_marks')
    .in('id', targetIds);
  const byId = new Map((targets ?? []).map((t) => [t.id as string, t]));
  for (const e of events ?? []) {
    const t = byId.get(e.target_id as string);
    if (!t) continue;
    const w = Number(e.weight) || SIGNAL_WEIGHT[e.kind as Signal] || 0;
    for (const k of traitsOfTarget(t)) weights.set(k, (weights.get(k) ?? 0) + w);
  }
  return weights;
}

export async function flagsFor(viewerId: string): Promise<Map<TraitKey, 'like' | 'avoid'>> {
  const flags = new Map<TraitKey, 'like' | 'avoid'>();
  if (!supabaseAdmin) return flags;
  const { data } = await supabaseAdmin.from('taste_flags').select('trait, flag').eq('user_id', viewerId);
  for (const f of data ?? []) flags.set(f.trait as TraitKey, f.flag as 'like' | 'avoid');
  return flags;
}

/** Match score for a viewer against one target (server computes it; the client only renders it). */
export async function matchFor(viewerId: string, targetId: string) {
  if (!supabaseAdmin) return null;
  const [{ data: t }, weights, flags] = await Promise.all([
    supabaseAdmin
      .from('users')
      .select('gender, orientation, communities, position_marks')
      .eq('id', targetId)
      .maybeSingle(),
    learnedWeights(viewerId),
    flagsFor(viewerId),
  ]);
  if (!t) return null;
  const { data: st } = await supabaseAdmin
    .from('statuses')
    .select('intent')
    .eq('user_id', targetId)
    .gt('ends_at', new Date().toISOString())
    .maybeSingle();
  const keys = traitsOfTarget({ ...t, intent: st?.intent ?? null });
  return scoreFor(keys, weights, flags);
}
