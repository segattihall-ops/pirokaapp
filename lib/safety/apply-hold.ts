import 'server-only';
import { supabaseAdmin } from '@/lib/db/client';
import { isMissingSchema } from '@/lib/db/schema-errors';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  HOLD_AUDIT,
  applyUnderageProtectiveHold,
  type HoldDeps,
  type HoldOutcome,
  type HoldUserPatch,
  type Visibility,
} from './hold';

const TARGET_COLS = 'id, deleted_at, visibility, age_verified, safety_hold_at';

function asVisibility(value: unknown): Visibility {
  return value === 'area' || value === 'hidden' ? value : 'neighborhood';
}

export function liveHoldDeps(): HoldDeps | null {
  if (!supabaseAdmin) return null;
  const db = supabaseAdmin;
  return {
    now: () => new Date(),
    async getTarget(id) {
      const { data, error } = await db.from('users').select(TARGET_COLS).eq('id', id).maybeSingle();
      if (error) {
        if (isMissingSchema(error)) return { ok: false, missingSchema: true };
        console.error('safety hold target read failed', error.code, error.message);
        throw new Error('safety hold target read failed');
      }
      if (!data) return { ok: true, target: null };
      return {
        ok: true,
        target: {
          id: data.id as string,
          deleted_at: (data.deleted_at as string | null) ?? null,
          visibility: asVisibility(data.visibility),
          age_verified: data.age_verified === true,
          safety_hold_at: (data.safety_hold_at as string | null) ?? null,
        },
      };
    },
    async countHolds(reporterId, sinceIso) {
      const { count, error } = await db
        .from('audit_log')
        .select('id', { count: 'exact', head: true })
        .eq('actor_id', reporterId)
        .eq('action', HOLD_AUDIT.applied)
        .gte('created_at', sinceIso);
      if (error) {
        console.error('safety hold rate read failed', error.code, error.message);
        throw new Error('safety hold rate read failed');
      }
      return count ?? 0;
    },
    async readGate(id) {
      const admin = createAdminClient();
      if (!admin) return null;
      const { data, error } = await admin.auth.admin.getUserById(id);
      if (error || !data.user) return null;
      return data.user.app_metadata?.age_verified === true;
    },
    async writeHold(id, patch: HoldUserPatch) {
      const { error } = await db.from('users').update(patch).eq('id', id);
      if (!error) return 'ok';
      if (isMissingSchema(error)) return 'missing_schema';
      console.error('safety hold write failed', error.code, error.message);
      return 'error';
    },
    async writeGate(id, metadata) {
      const admin = createAdminClient();
      if (!admin) return false;
      const { error } = await admin.auth.admin.updateUserById(id, { app_metadata: { ...metadata } });
      if (error) {
        console.error('safety hold require-id failed', error.message);
        return false;
      }
      return true;
    },
    async markGateWritten(id) {
      const { error } = await db.from('users').update({ safety_hold_gate_written: true }).eq('id', id);
      if (error) {
        console.error('safety hold gate flag failed', error.code, error.message);
        return false;
      }
      return true;
    },
    async audit(action, details) {
      const { error } = await db.from('audit_log').insert({
        actor_id: null,
        action,
        target: typeof details.reportId === 'string' ? details.reportId : null,
        details,
      });
      if (error) console.error('safety hold audit failed', error.code, error.message);
    },
  };
}

export async function maybeApplyUnderageHold(args: {
  reason: string;
  reporterId: string;
  reporterAgeVerified: boolean;
  targetId: string;
  reportId: string;
}): Promise<HoldOutcome> {
  const deps = liveHoldDeps();
  if (!deps) return { apply: false, skip: 'write_failed' };
  // The reporter is the actor on the audit rows this call writes.
  const audited: HoldDeps = {
    ...deps,
    audit: async (action, details) => {
      if (!supabaseAdmin) return;
      const { error } = await supabaseAdmin.from('audit_log').insert({
        actor_id: args.reporterId,
        action,
        target: args.reportId,
        target_user_id: args.targetId,
        details,
      });
      if (error) console.error('safety hold audit failed', error.code, error.message);
    },
  };
  return applyUnderageProtectiveHold(args, audited);
}
