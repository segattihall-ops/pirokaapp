import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireAdmin } from '@/lib/admin/guard';
import { isUuid } from '@/lib/api/guard';
import { isMissingSchema } from '@/lib/db/schema-errors';
import { createAdminClient } from '@/lib/supabase/admin';
import { HOLD_AUDIT, releaseHoldPatch, type Visibility } from '@/lib/safety/hold';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

/**
 * Releases the reversible underage protective hold. Restores the saved visibility and, when this
 * hold flagged Require ID, puts the 18+ gate back. Does not delete the account or set a mod step.
 */
export async function POST(_request: Request, { params }: Ctx) {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const { data, error } = await supabaseAdmin
    .from('users')
    .select(
      'id, safety_hold_at, safety_hold_report_id, safety_hold_prev_visibility, safety_hold_prev_age_verified, safety_hold_prev_gate, safety_hold_gate_written',
    )
    .eq('id', params.id)
    .maybeSingle();
  if (error) {
    if (isMissingSchema(error)) {
      return NextResponse.json(
        { error: 'Protective holds need the database update 051_underage_protective_hold.' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!data.safety_hold_at)
    return NextResponse.json({ error: 'No protective hold on this account' }, { status: 409 });

  const visibility = data.safety_hold_prev_visibility;
  const prevVisibility: Visibility =
    visibility === 'area' || visibility === 'hidden' ? visibility : 'neighborhood';
  const released = releaseHoldPatch({
    safety_hold_prev_visibility: prevVisibility,
    safety_hold_prev_age_verified: data.safety_hold_prev_age_verified === true,
    safety_hold_prev_gate:
      data.safety_hold_prev_gate === true ? true : data.safety_hold_prev_gate === false ? false : null,
    safety_hold_gate_written: data.safety_hold_gate_written === true,
  });

  if (released.gate) {
    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    const { error: gateError } = await admin.auth.admin.updateUserById(params.id, {
      app_metadata: released.gate,
    });
    if (gateError) {
      await supabaseAdmin.from('audit_log').insert({
        actor_id: g.session.userId,
        action: HOLD_AUDIT.failed,
        target: params.id,
        target_user_id: params.id,
        details: { reportId: data.safety_hold_report_id ?? null, step: 'release_gate' },
      });
      return NextResponse.json(
        { error: 'Could not restore the age check. The hold is still on.' },
        { status: 500 },
      );
    }
  }

  const { error: clearError } = await supabaseAdmin.from('users').update(released.users).eq('id', params.id);
  if (clearError) return NextResponse.json({ error: clearError.message }, { status: 500 });

  await supabaseAdmin.from('audit_log').insert({
    actor_id: g.session.userId,
    action: HOLD_AUDIT.released,
    target: params.id,
    target_user_id: params.id,
    details: {
      reportId: data.safety_hold_report_id ?? null,
      restoredVisibility: released.users.visibility,
      restoredAgeVerified: released.users.age_verified,
      restoredGate: released.gate?.age_verified ?? null,
    },
  });
  return NextResponse.json({ ok: true });
}
