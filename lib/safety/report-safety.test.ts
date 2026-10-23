import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import {
  IN_APP_REASON_LABELS,
  IN_APP_REASONS,
  PUBLIC_QUEUE_REASON,
  PUBLIC_REPORT_TYPES,
  REASON_SEVERITY,
  SEVERITY_RANK,
  isCriticalReason,
  reportAlertText,
  severityRank,
  sortReportQueue,
} from './reasons';
import {
  HOLD_AUDIT,
  REQUIRE_ID_APP_METADATA,
  UNDERAGE_HOLDS_PER_WINDOW,
  applyUnderageProtectiveHold,
  protectiveHoldPatch,
  releaseHoldPatch,
  type HoldDeps,
  type HoldTarget,
  type HoldUserPatch,
} from './hold';

const root = process.cwd();
const source = (path: string) => readFileSync(`${root}/${path}`, 'utf8');

const CRITICAL_SLUGS = ['underage', 'csam', 'threats', 'stalking', 'sextortion', 'ncii'] as const;

describe('reason severity map', () => {
  test('every in-app slug and public stored reason has a rank', () => {
    for (const slug of IN_APP_REASONS) {
      assert.ok(REASON_SEVERITY[slug], `missing severity for in-app slug ${slug}`);
      assert.equal(IN_APP_REASON_LABELS[slug] !== undefined, true, slug);
    }
    for (const label of PUBLIC_REPORT_TYPES) {
      const stored = PUBLIC_QUEUE_REASON[label];
      assert.ok(stored, label);
      assert.ok(REASON_SEVERITY[stored], `missing severity for public reason ${stored}`);
    }
    assert.deepEqual(Object.keys(IN_APP_REASON_LABELS).sort(), [...IN_APP_REASONS].sort());
  });

  test('the report UI and APIs cannot introduce a slug the map does not know', () => {
    const menu = source('components/chat/safety-menu.tsx');
    const route = source('app/api/safety/report/route.ts');
    const help = source('app/api/help/report/route.ts');
    const form = source('components/help/report-form.tsx');

    assert.match(menu, /IN_APP_REASONS/);
    assert.match(route, /z\.enum\(IN_APP_REASONS\)/);
    assert.match(help, /PUBLIC_QUEUE_REASON/);
    assert.match(form, /PUBLIC_REPORT_TYPES/);
    assert.doesNotMatch(menu, /const REASONS:\s*\{/);
    assert.doesNotMatch(route, /const REPORT_REASONS/);
    assert.doesNotMatch(help, /const QUEUE_REASON/);
    assert.doesNotMatch(form, /const TYPES/);

    for (const file of [menu, route, help, form]) {
      for (const match of file.matchAll(/value:\s*'([a-z0-9_]+)'/g)) {
        assert.ok(
          REASON_SEVERITY[match[1]],
          `${match[1]} is used by the report UI and is not in the severity map`,
        );
      }
    }
  });

  test('critical slugs are the 4h clock and the rest are ranked on purpose', () => {
    for (const slug of CRITICAL_SLUGS) {
      assert.equal(severityRank(slug), SEVERITY_RANK.critical, slug);
      assert.equal(isCriticalReason(slug), true);
    }
    assert.equal(severityRank('Underage'), SEVERITY_RANK.critical);
    assert.equal(severityRank('Shared my photos'), SEVERITY_RANK.critical);
    assert.equal(severityRank('Illegal content'), SEVERITY_RANK.critical);
    assert.equal(severityRank('Threats or violence'), SEVERITY_RANK.critical);
    assert.equal(severityRank('harassment'), SEVERITY_RANK.medium);
    assert.equal(severityRank('Harassment'), SEVERITY_RANK.medium);
    assert.equal(severityRank('hate'), SEVERITY_RANK.medium);
    assert.equal(severityRank('unsafe'), SEVERITY_RANK.medium);
    assert.equal(severityRank('spam'), SEVERITY_RANK.low);
    assert.equal(severityRank('impersonation'), SEVERITY_RANK.low);
    assert.equal(severityRank('other'), SEVERITY_RANK.low);
    assert.equal(severityRank('not-a-real-reason'), SEVERITY_RANK.low);
  });
});

describe('admin queue order', () => {
  test('critical reports sort ahead of newer medium and low reports', () => {
    const sorted = sortReportQueue([
      { id: 'spam', reason: 'spam', createdAt: '2026-10-23T18:00:00.000Z' },
      { id: 'old-underage', reason: 'underage', createdAt: '2026-10-22T00:00:00.000Z' },
      { id: 'new-csam', reason: 'csam', createdAt: '2026-10-23T12:00:00.000Z' },
      { id: 'hate', reason: 'hate', createdAt: '2026-10-23T18:00:00.000Z' },
      { id: 'harass', reason: 'harassment', createdAt: '2026-10-23T19:00:00.000Z' },
    ]);
    assert.deepEqual(
      sorted.map((row) => row.id),
      ['new-csam', 'old-underage', 'harass', 'hate', 'spam'],
    );
  });
});

describe('ops alert text', () => {
  test('critical and ordinary alerts carry type, severity, id, and the admin link only', () => {
    const text = reportAlertText({
      reason: 'underage',
      reportId: 'TS-1042',
      origin: 'https://www.pirokaapp.com',
    });
    assert.equal(text, 'type=underage severity=critical id=TS-1042 https://www.pirokaapp.com/admin/reports');
    const medium = reportAlertText({
      reason: 'spam',
      reportId: 'TS-2',
      origin: 'https://www.pirokaapp.com/',
    });
    assert.equal(medium, 'type=spam severity=low id=TS-2 https://www.pirokaapp.com/admin/reports');

    const leaked = reportAlertText({
      reason: '32.7767,-96.7937',
      reportId: 'TS-9\nsecret@example.com said "meet me at the pin"',
      origin: 'https://www.pirokaapp.com\n',
    });
    assert.equal(leaked, 'type=unknown severity=low id=unknown https://www.pirokaapp.com/admin/reports');
    assert.doesNotMatch(leaked, /32\.7767|96\.7937|@|said|meet|pin|secret/);
  });

  test('the report routes do not pass the narrative into opsAlert', () => {
    const safety = source('app/api/safety/report/route.ts');
    const help = source('app/api/help/report/route.ts');
    assert.match(
      safety,
      /reportAlertText\(\{\s*reason,\s*reportId:\s*data\.id,\s*origin:\s*appUrl\(\)\s*\}\)/,
    );
    assert.match(
      help,
      /reportAlertText\(\{\s*reason:\s*storedReason,\s*reportId:\s*id,\s*origin:\s*appUrl\(\)\s*\}\)/,
    );
    for (const file of [safety, help]) {
      const alertAt = file.indexOf('opsAlert(');
      assert.ok(alertAt > 0);
      const line = file.slice(alertAt, file.indexOf('\n', alertAt));
      assert.match(line, /reportAlertText\(/);
      assert.doesNotMatch(line, /details|narrative|conversationId|reporter_ip|latitude|longitude|@/);
    }
  });
});

const target = (): HoldTarget => ({
  id: '11111111-1111-4111-8111-111111111111',
  deleted_at: null,
  visibility: 'neighborhood',
  age_verified: true,
  safety_hold_at: null,
});

function harness(patch: Partial<HoldDeps> = {}) {
  const audits: { action: string; details: Record<string, unknown> }[] = [];
  const holds: HoldUserPatch[] = [];
  const gates: unknown[] = [];
  let gateMarked = 0;
  const deps: HoldDeps = {
    now: () => new Date('2026-10-23T12:00:00.000Z'),
    getTarget: async () => ({ ok: true, target: target() }),
    countHolds: async () => 0,
    readGate: async () => true,
    writeHold: async (_id, row) => {
      holds.push(row);
      return 'ok';
    },
    writeGate: async (_id, metadata) => {
      gates.push(metadata);
      return true;
    },
    markGateWritten: async () => {
      gateMarked += 1;
      return true;
    },
    audit: async (action, details) => {
      audits.push({ action, details });
    },
    ...patch,
  };
  return {
    deps,
    audits,
    holds,
    gates,
    get gateMarked() {
      return gateMarked;
    },
  };
}

describe('underage protective hold', () => {
  test('an underage report from an age-verified reporter hides the account and flags Require ID', async () => {
    const h = harness();
    const outcome = await applyUnderageProtectiveHold(
      {
        reason: 'underage',
        reporterId: 'reporter',
        reporterAgeVerified: true,
        targetId: target().id,
        reportId: 'TS-1042',
      },
      h.deps,
    );
    assert.deepEqual(outcome, { apply: true, requireId: true });
    assert.equal(h.holds.length, 1);
    const row = h.holds[0];
    assert.equal(row.visibility, 'hidden');
    assert.equal(row.age_verified, false);
    assert.equal(row.safety_hold_at, '2026-10-23T12:00:00.000Z');
    assert.equal(row.safety_hold_report_id, 'TS-1042');
    assert.equal(row.safety_hold_prev_visibility, 'neighborhood');
    assert.equal(row.safety_hold_prev_age_verified, true);
    assert.equal(row.safety_hold_prev_gate, true);
    assert.equal(row.safety_hold_gate_written, false);
    for (const key of ['deleted_at', 'mod_step', 'ban_duration', 'email', 'bio', 'details']) {
      assert.equal(key in row, false, key);
    }
    assert.deepEqual(h.gates, [REQUIRE_ID_APP_METADATA]);
    assert.equal(h.gateMarked, 1);
    assert.equal(
      h.audits.some((a) => a.action === HOLD_AUDIT.applied),
      true,
    );
    const applied = h.audits.find((a) => a.action === HOLD_AUDIT.applied);
    assert.equal(JSON.stringify(applied).includes('TS-1042'), true);
    assert.doesNotMatch(JSON.stringify(applied), /@|lat|lon|narrative|password/);
  });

  test('release restores visibility and the 18+ gate and does not delete', () => {
    const released = releaseHoldPatch({
      safety_hold_prev_visibility: 'area',
      safety_hold_prev_age_verified: true,
      safety_hold_prev_gate: true,
      safety_hold_gate_written: true,
    });
    assert.equal(released.users.visibility, 'area');
    assert.equal(released.users.safety_hold_at, null);
    assert.equal(released.users.safety_hold_report_id, null);
    assert.equal(released.users.age_verified, true);
    assert.equal(released.users.safety_hold_gate_written, false);
    assert.deepEqual(released.gate, { age_verified: true, age_recheck: false });
    for (const key of ['deleted_at', 'mod_step', 'ban_duration']) {
      assert.equal(key in released.users, false, key);
    }

    const untouchedGate = releaseHoldPatch({
      safety_hold_prev_visibility: 'neighborhood',
      safety_hold_prev_age_verified: true,
      safety_hold_prev_gate: null,
      safety_hold_gate_written: false,
    });
    assert.equal(untouchedGate.gate, null);
    assert.equal(untouchedGate.users.visibility, 'neighborhood');
  });

  test('other critical reasons do not auto-hold', async () => {
    for (const reason of ['csam', 'threats', 'stalking', 'sextortion', 'ncii', 'Underage', 'harassment']) {
      const h = harness({
        getTarget: async () => {
          throw new Error(`should not read the target for ${reason}`);
        },
        writeHold: async () => {
          throw new Error(`should not write a hold for ${reason}`);
        },
      });
      const outcome = await applyUnderageProtectiveHold(
        {
          reason,
          reporterId: 'reporter',
          reporterAgeVerified: true,
          targetId: target().id,
          reportId: 'TS-1',
        },
        h.deps,
      );
      assert.deepEqual(outcome, { apply: false, skip: 'not_auto_hold' });
      assert.equal(h.audits.length, 0);
    }
  });

  test('an unverified reporter does not place a hold', async () => {
    const h = harness({
      getTarget: async () => {
        throw new Error('should not read the target');
      },
    });
    const outcome = await applyUnderageProtectiveHold(
      {
        reason: 'underage',
        reporterId: 'reporter',
        reporterAgeVerified: false,
        targetId: target().id,
        reportId: 'TS-3',
      },
      h.deps,
    );
    assert.deepEqual(outcome, { apply: false, skip: 'reporter_not_age_gated' });
    assert.equal(h.holds.length, 0);
    assert.equal(h.audits[0]?.action, HOLD_AUDIT.skipped);
    assert.equal(h.audits[0]?.details.skip, 'reporter_not_age_gated');
  });

  test('a reporter is limited to two underage holds in the window', async () => {
    const h = harness({ countHolds: async () => UNDERAGE_HOLDS_PER_WINDOW });
    const outcome = await applyUnderageProtectiveHold(
      {
        reason: 'underage',
        reporterId: 'reporter',
        reporterAgeVerified: true,
        targetId: target().id,
        reportId: 'TS-4',
      },
      h.deps,
    );
    assert.deepEqual(outcome, { apply: false, skip: 'rate_limited' });
    assert.equal(h.holds.length, 0);
    assert.equal(h.gates.length, 0);
    assert.equal(h.audits[0]?.details.skip, 'rate_limited');

    const allowed = harness({ countHolds: async () => UNDERAGE_HOLDS_PER_WINDOW - 1 });
    const placed = await applyUnderageProtectiveHold(
      {
        reason: 'underage',
        reporterId: 'reporter',
        reporterAgeVerified: true,
        targetId: target().id,
        reportId: 'TS-5',
      },
      allowed.deps,
    );
    assert.equal(placed.apply, true);
    assert.equal(allowed.holds.length, 1);
  });

  test('an account already on hold is not rewritten', async () => {
    const h = harness({
      getTarget: async () => ({
        ok: true,
        target: { ...target(), safety_hold_at: '2026-10-01T00:00:00.000Z', visibility: 'hidden' },
      }),
    });
    const outcome = await applyUnderageProtectiveHold(
      {
        reason: 'underage',
        reporterId: 'reporter',
        reporterAgeVerified: true,
        targetId: target().id,
        reportId: 'TS-6',
      },
      h.deps,
    );
    assert.deepEqual(outcome, { apply: false, skip: 'already_held' });
    assert.equal(h.holds.length, 0);
  });

  test('a missing column is a fallback and does not write the hold', async () => {
    const unread = harness({ getTarget: async () => ({ ok: false, missingSchema: true }) });
    const unreadOutcome = await applyUnderageProtectiveHold(
      {
        reason: 'underage',
        reporterId: 'reporter',
        reporterAgeVerified: true,
        targetId: target().id,
        reportId: 'TS-8',
      },
      unread.deps,
    );
    assert.deepEqual(unreadOutcome, { apply: false, skip: 'schema_pending' });
    assert.equal(unread.holds.length, 0);
    assert.equal(unread.audits[0]?.action, HOLD_AUDIT.schemaPending);

    const unwritten = harness({ writeHold: async () => 'missing_schema' });
    const unwrittenOutcome = await applyUnderageProtectiveHold(
      {
        reason: 'underage',
        reporterId: 'reporter',
        reporterAgeVerified: true,
        targetId: target().id,
        reportId: 'TS-9',
      },
      unwritten.deps,
    );
    assert.deepEqual(unwrittenOutcome, { apply: false, skip: 'schema_pending' });
    assert.equal(unwritten.holds.length, 0);
    assert.equal(unwritten.audits.at(-1)?.action, HOLD_AUDIT.schemaPending);
  });

  test('the hold patch itself is not a ban', () => {
    const patch = protectiveHoldPatch(target(), 'TS-7', '2026-10-23T12:00:00.000Z', true);
    assert.equal(patch.visibility, 'hidden');
    assert.equal('deleted_at' in patch, false);
    assert.equal('mod_step' in patch, false);
    assert.equal('ban_duration' in patch, false);
  });
});

describe('migration file', () => {
  test('the hold migration records the production version and does not delete', () => {
    const sql = source('supabase/migrations/20261023190000_051_underage_protective_hold.sql');
    assert.match(sql, /safety_hold_at/);
    assert.match(sql, /20261023190526/);
    assert.match(sql, /underage_protective_hold/);
    assert.match(sql, /users_safety_hold_hidden/);
    assert.match(sql, /Do not run this/);
    assert.doesNotMatch(sql, /NOT APPLIED/);
    assert.doesNotMatch(sql, /delete from|drop table|ban_duration/i);
  });
});
