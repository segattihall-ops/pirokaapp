import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import {
  ageCheckLabel,
  evaluateDecision,
  fetchDiditDecision,
  markAgeVerified,
  verifyDiditWebhook,
  type DiditEvent,
} from '@/lib/age/didit';
import { track } from '@/lib/analytics/server';
import { captureError } from '@/lib/errors/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Didit → us. Steps, in order:
 *  1. raw body → signature (V2, raw, simple) → freshness on the signed body `timestamp`
 *  2. durable dedupe: insert event_id into didit_webhook_events; a conflict means "already seen"
 *  3. apply: record the user's age-check status; on Approved re-fetch the decision from Didit and
 *     grant 18+ only if it is ours, for this user, and approved
 * Answers 2xx for anything authenticated (including ignored event types) so Didit doesn't retry.
 * A failure while applying returns 500 and releases the dedupe row, so Didit's retry can apply it.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const check = verifyDiditWebhook(raw, request.headers);
  if (!check.ok) {
    if (check.reason !== 'stale') console.warn('didit webhook rejected', check.reason, raw.slice(0, 2000));
    const status = check.reason === 'not_configured' ? 503 : 401;
    return NextResponse.json({ error: check.reason }, { status });
  }
  const event = check.event;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  if (!event.event_id || !UUID.test(event.event_id))
    return NextResponse.json({ ok: true, ignored: 'no event_id' });

  const { data: claimed, error: claimError } = await supabaseAdmin
    .from('didit_webhook_events')
    .upsert(
      {
        event_id: event.event_id,
        webhook_type: String(event.webhook_type ?? 'unknown'),
        session_id: event.session_id && UUID.test(event.session_id) ? event.session_id : null,
        status: event.status ?? null,
        vendor_data: event.vendor_data ?? null,
      },
      { onConflict: 'event_id', ignoreDuplicates: true },
    )
    .select('event_id');
  if (claimError) {
    await captureError(claimError, { route: '/api/webhooks/didit' });
    return NextResponse.json({ error: 'Could not record event' }, { status: 500 });
  }
  if (!claimed || claimed.length === 0) return NextResponse.json({ ok: true, duplicate: true });

  try {
    const result = await apply(event);
    await supabaseAdmin
      .from('didit_webhook_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('event_id', event.event_id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    await supabaseAdmin.from('didit_webhook_events').delete().eq('event_id', event.event_id);
    const ref = await captureError(e, { route: '/api/webhooks/didit' });
    return NextResponse.json({ error: 'Processing failed', ref }, { status: 500 });
  }
}

async function apply(event: DiditEvent): Promise<Record<string, unknown>> {
  const db = supabaseAdmin!;
  // We only create user sessions; entity, activity, transaction and data.updated events are
  // acknowledged but carry nothing the age gate needs.
  if (event.webhook_type !== 'status.updated' || event.session_kind === 'business')
    return { ignored: event.webhook_type };
  const userId = event.vendor_data;
  if (!userId || !UUID.test(userId) || !event.session_id) return { ignored: 'no user' };

  const label = ageCheckLabel(event.status);
  if (label) {
    const { error } = await db
      .from('users')
      .update({ age_check_status: label, age_check_updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) throw error;
  }

  if (event.status !== 'Approved' && event.status !== 'Declined') return { status: label };

  // The body is only a trigger: the decision of record comes from Didit's API.
  const decision = await fetchDiditDecision(event.session_id);
  // Didit unreachable: fail so its retry (≈1 min, then ≈4 min) gets another chance.
  if (!decision) throw new Error('Could not fetch Didit decision');
  const result = evaluateDecision(decision, userId);
  if (result.ok && !(await markAgeVerified(userId, result.method))) throw new Error('Could not grant 18+');

  await db.from('audit_log').insert({
    actor_id: null,
    action: result.ok ? 'age.verified' : 'age.declined',
    target: event.session_id,
    target_user_id: userId,
    details: result.ok
      ? { method: result.method, provider: 'didit' }
      : { reason: result.reason, status: event.status },
  });
  void track({ userId, event: result.ok ? 'age_verified' : 'age_declined', props: { provider: 'didit' } });
  return { status: label, verified: result.ok };
}
