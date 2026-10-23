/**
 * Reversible protective hold for an in-app `underage` report.
 *
 * The hold hides the account (visibility hidden) and records enough to put that visibility
 * and the 18+ gate back. It does not set mod_step, deleted_at, or an auth ban.
 * Other reasons, including other critical reasons, do not auto-act.
 *
 * Abuse trade-off (also in docs/trust-safety/REPORT_SEVERITY.md): the hold runs only when the
 * reporter's session is already age-verified, and at most UNDERAGE_HOLDS_PER_WINDOW times per
 * reporter per window. A verified member can still file a false report; the cap limits how
 * many accounts one person can freeze. Unverified reporters still create a critical report and
 * an ops alert, and a person applies the hold. Requiring a second check (photo verified, or an
 * account older than a day) would leave a reported minor visible while the only witness is new.
 */

export const UNDERAGE_HOLDS_PER_WINDOW = 2;
export const UNDERAGE_HOLD_WINDOW_MS = 24 * 60 * 60 * 1000;

export const HOLD_AUDIT = {
  applied: 'safety.hold_applied',
  skipped: 'safety.hold_skipped',
  schemaPending: 'safety.hold_schema_pending',
  failed: 'safety.hold_failed',
  requireIdFailed: 'safety.hold_require_id_failed',
  released: 'safety.hold_released',
} as const;

/** Same auth metadata as Admin → Users → Require ID. Not a ban. */
export const REQUIRE_ID_APP_METADATA = {
  age_verified: false,
  age_method: null,
  age_recheck: true,
} as const;

export type Visibility = 'neighborhood' | 'area' | 'hidden';

export type HoldSkip =
  | 'not_auto_hold'
  | 'reporter_not_age_gated'
  | 'rate_limited'
  | 'already_held'
  | 'target_gone'
  | 'schema_pending'
  | 'write_failed';

export type HoldTarget = {
  id: string;
  deleted_at: string | null;
  visibility: Visibility;
  age_verified: boolean;
  safety_hold_at: string | null;
};

export function decideProtectiveHold(input: {
  reason: string;
  reporterAgeVerified: boolean;
  holdsInWindow: number;
  alreadyHeld: boolean;
  targetDeleted: boolean;
}): { apply: true } | { apply: false; skip: HoldSkip } {
  // Only the in-app slug. Public-form "Underage" has no target account to hold.
  if (input.reason !== 'underage') return { apply: false, skip: 'not_auto_hold' };
  if (!input.reporterAgeVerified) return { apply: false, skip: 'reporter_not_age_gated' };
  if (input.targetDeleted) return { apply: false, skip: 'target_gone' };
  if (input.alreadyHeld) return { apply: false, skip: 'already_held' };
  if (input.holdsInWindow >= UNDERAGE_HOLDS_PER_WINDOW) return { apply: false, skip: 'rate_limited' };
  return { apply: true };
}

export type HoldUserPatch = {
  safety_hold_at: string;
  safety_hold_report_id: string;
  safety_hold_prev_visibility: Visibility;
  safety_hold_prev_age_verified: boolean;
  safety_hold_prev_gate: boolean | null;
  safety_hold_gate_written: boolean;
  visibility: 'hidden';
  age_verified: false;
};

/** Fields written onto users. Never a ban, a mod step, or a deletion. */
export function protectiveHoldPatch(
  target: HoldTarget,
  reportId: string,
  atIso: string,
  prevGate: boolean | null,
): HoldUserPatch {
  return {
    safety_hold_at: atIso,
    safety_hold_report_id: reportId,
    safety_hold_prev_visibility: target.visibility,
    safety_hold_prev_age_verified: target.age_verified,
    safety_hold_prev_gate: prevGate,
    safety_hold_gate_written: false,
    visibility: 'hidden',
    age_verified: false,
  };
}

export type HeldRow = {
  safety_hold_prev_visibility: Visibility | null;
  safety_hold_prev_age_verified: boolean | null;
  safety_hold_prev_gate: boolean | null;
  safety_hold_gate_written: boolean;
};

export type ReleaseGate =
  { age_verified: true; age_recheck: false } | { age_verified: false; age_recheck: false; age_method: null };

export function releaseHoldPatch(row: HeldRow): {
  users: {
    safety_hold_at: null;
    safety_hold_report_id: null;
    safety_hold_prev_visibility: null;
    safety_hold_prev_age_verified: null;
    safety_hold_prev_gate: null;
    safety_hold_gate_written: false;
    visibility: Visibility;
    age_verified: boolean;
  };
  gate: ReleaseGate | null;
} {
  const gate: ReleaseGate | null = row.safety_hold_gate_written
    ? row.safety_hold_prev_gate === true
      ? { age_verified: true, age_recheck: false }
      : { age_verified: false, age_recheck: false, age_method: null }
    : null;
  return {
    users: {
      safety_hold_at: null,
      safety_hold_report_id: null,
      safety_hold_prev_visibility: null,
      safety_hold_prev_age_verified: null,
      safety_hold_prev_gate: null,
      safety_hold_gate_written: false,
      visibility: row.safety_hold_prev_visibility ?? 'neighborhood',
      age_verified: row.safety_hold_prev_age_verified === true,
    },
    gate,
  };
}

export type TargetLookup = { ok: true; target: HoldTarget | null } | { ok: false; missingSchema: true };

export type HoldDeps = {
  now: () => Date;
  getTarget: (id: string) => Promise<TargetLookup>;
  countHolds: (reporterId: string, sinceIso: string) => Promise<number>;
  /** null when the previous 18+ flag could not be read. */
  readGate: (id: string) => Promise<boolean | null>;
  writeHold: (id: string, patch: HoldUserPatch) => Promise<'ok' | 'missing_schema' | 'error'>;
  writeGate: (id: string, metadata: typeof REQUIRE_ID_APP_METADATA) => Promise<boolean>;
  markGateWritten: (id: string) => Promise<boolean>;
  audit: (action: string, details: Record<string, unknown>) => Promise<void>;
};

export type HoldOutcome = { apply: true; requireId: boolean } | { apply: false; skip: HoldSkip };

/**
 * Decides and applies the hold. `not_auto_hold` performs no reads and no writes.
 * Audit details are ids and enums only.
 */
export async function applyUnderageProtectiveHold(
  args: {
    reason: string;
    reporterId: string;
    reporterAgeVerified: boolean;
    targetId: string;
    reportId: string;
  },
  deps: HoldDeps,
): Promise<HoldOutcome> {
  if (args.reason !== 'underage') return { apply: false, skip: 'not_auto_hold' };

  if (!args.reporterAgeVerified) {
    await deps.audit(HOLD_AUDIT.skipped, { reportId: args.reportId, skip: 'reporter_not_age_gated' });
    return { apply: false, skip: 'reporter_not_age_gated' };
  }

  const found = await deps.getTarget(args.targetId);
  if (!found.ok) {
    await deps.audit(HOLD_AUDIT.schemaPending, { reportId: args.reportId });
    return { apply: false, skip: 'schema_pending' };
  }
  if (!found.target || found.target.deleted_at) return { apply: false, skip: 'target_gone' };

  const since = new Date(deps.now().getTime() - UNDERAGE_HOLD_WINDOW_MS).toISOString();
  const holdsInWindow = await deps.countHolds(args.reporterId, since);
  const decision = decideProtectiveHold({
    reason: args.reason,
    reporterAgeVerified: true,
    holdsInWindow,
    alreadyHeld: Boolean(found.target.safety_hold_at),
    targetDeleted: false,
  });
  if (!decision.apply) {
    if (decision.skip === 'rate_limited') {
      await deps.audit(HOLD_AUDIT.skipped, { reportId: args.reportId, skip: 'rate_limited' });
    }
    return decision;
  }

  const prevGate = await deps.readGate(args.targetId);
  const patch = protectiveHoldPatch(found.target, args.reportId, deps.now().toISOString(), prevGate);
  const wrote = await deps.writeHold(args.targetId, patch);
  if (wrote === 'missing_schema') {
    await deps.audit(HOLD_AUDIT.schemaPending, { reportId: args.reportId });
    return { apply: false, skip: 'schema_pending' };
  }
  if (wrote !== 'ok') {
    await deps.audit(HOLD_AUDIT.failed, { reportId: args.reportId });
    return { apply: false, skip: 'write_failed' };
  }

  let requireId = false;
  if (prevGate !== null) {
    requireId = await deps.writeGate(args.targetId, REQUIRE_ID_APP_METADATA);
    if (requireId) {
      const flagged = await deps.markGateWritten(args.targetId);
      if (!flagged) requireId = false;
    }
  }
  if (!requireId) {
    await deps.audit(HOLD_AUDIT.requireIdFailed, { reportId: args.reportId });
  }

  await deps.audit(HOLD_AUDIT.applied, {
    reportId: args.reportId,
    prevVisibility: found.target.visibility,
    prevAgeVerified: found.target.age_verified,
    prevGate,
    requireId,
  });
  return { apply: true, requireId };
}
