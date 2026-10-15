import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { evaluateDecision, fetchDiditDecision, markAgeVerified, verifyDiditWebhook } from '@/lib/age/didit';
import { track } from '@/lib/analytics/server';
import { withApi } from '@/lib/errors/server';

export const dynamic = 'force-dynamic';

/**
 * Didit → us. Signed with the destination secret (X-Signature-V2). Covers users who close the tab
 * before returning, and decisions that land later after manual review. The decision is re-fetched
 * from Didit's API before acting, so the body is only a trigger. Always 200 once authenticated, so
 * Didit doesn't retry events we deliberately ignore.
 */
export const POST = withApi('/api/webhooks/didit', async (request: Request) => {
  const raw = await request.text();
  if (!verifyDiditWebhook(raw, request.headers)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(raw) as {
    webhook_type?: string;
    session_id?: string;
    status?: string;
    vendor_data?: string;
  };
  if (event.webhook_type !== 'status.updated' || !event.session_id || !event.vendor_data) {
    return NextResponse.json({ ok: true, ignored: true });
  }
  if (!/^[0-9a-f-]{36}$/i.test(event.vendor_data)) return NextResponse.json({ ok: true, ignored: true });

  const userId = event.vendor_data;
  if (event.status !== 'Approved' && event.status !== 'Declined') return NextResponse.json({ ok: true });

  const result = evaluateDecision(await fetchDiditDecision(event.session_id), userId);
  if (result.ok) await markAgeVerified(userId, result.method);

  if (supabaseAdmin) {
    await supabaseAdmin.from('audit_log').insert({
      actor_id: null,
      action: result.ok ? 'age.verified' : 'age.declined',
      target: event.session_id,
      target_user_id: userId,
      details: result.ok ? { method: result.method, provider: 'didit' } : { reason: result.reason },
    });
  }
  void track({ userId, event: result.ok ? 'age_verified' : 'age_declined', props: { provider: 'didit' } });
  return NextResponse.json({ ok: true });
});
