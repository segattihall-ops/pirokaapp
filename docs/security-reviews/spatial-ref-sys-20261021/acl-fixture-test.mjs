import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const evidence = JSON.parse(await readFile(new URL('./observed-catalog.json', import.meta.url), 'utf8'));
const forwardOriginal = await readFile(new URL('./spatial_ref_sys.forward.sql', import.meta.url), 'utf8');
const rollbackOriginal = await readFile(new URL('./spatial_ref_sys.rollback.sql', import.meta.url), 'utf8');
const targetRoles = new Set(['anon', 'authenticated']);
const restricted = ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'];
const key = row => [row.grantee, row.grantor, row.privilege, String(row.grantable)].join('|');
const normalize = rows => rows.map(({ grantee, grantor, privilege, grantable }) =>
  ({ grantee, grantor, privilege, grantable })).sort((a, b) => key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);
const baselineExpected = normalize(evidence.acl[0].grants);
const restrictedExpected = baselineExpected.filter(row => !(targetRoles.has(row.grantee) && restricted.includes(row.privilege)));
const results = [];
let active;
let version;

function check(name, actual, expected) {
  assert.deepEqual(actual, expected, name);
  results.push({ name, status: 'PASS' });
  console.log('PASS ' + name);
}

// PGlite contains plpgsql, not PostGIS. The synthetic table is a real member
// of that native extension. Substitute only the expected extension NAME;
// every catalog check, owner check, DCL statement and postcondition is unchanged.
// A separate negative case executes the unmodified PostGIS guard.
function fixtureSql(sql) {
  const marker = "v_expected_extension constant name := 'postgis';";
  assert.equal(sql.split(marker).length - 1, 1);
  return sql.replace(marker, "v_expected_extension constant name := 'plpgsql';");
}
const forward = fixtureSql(forwardOriginal);
const rollback = fixtureSql(rollbackOriginal);

async function fixture() {
  const db = await PGlite.create();
  version ??= (await db.query("SELECT current_setting('server_version') AS version")).rows[0].version;
  await db.exec(`
    CREATE ROLE supabase_admin NOLOGIN;
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN;
    CREATE ROLE fixture_sql_actor NOLOGIN INHERIT;
    GRANT postgres TO fixture_sql_actor;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, supabase_admin;
    CREATE SCHEMA fixture_scratch;
    GRANT USAGE, CREATE ON SCHEMA fixture_scratch TO anon, authenticated;
    CREATE TABLE public.spatial_ref_sys (
      srid integer PRIMARY KEY, auth_name text, auth_srid integer, srtext text, proj4text text
    );
    INSERT INTO public.spatial_ref_sys VALUES
      (4326, 'FIXTURE', 4326, 'synthetic row A', 'synthetic A'),
      (3857, 'FIXTURE', 3857, 'synthetic row B', 'synthetic B');
    ALTER EXTENSION plpgsql ADD TABLE public.spatial_ref_sys;
    ALTER TABLE public.spatial_ref_sys OWNER TO supabase_admin;
    GRANT SELECT ON public.spatial_ref_sys TO PUBLIC;
    GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
      ON public.spatial_ref_sys TO supabase_admin, postgres, anon, authenticated, service_role;
    CREATE FUNCTION public.fixture_trigger() RETURNS trigger LANGUAGE plpgsql AS
      'BEGIN RETURN NEW; END';
    ALTER DEFAULT PRIVILEGES IN SCHEMA fixture_scratch GRANT SELECT ON TABLES TO authenticated;
  `);
  return db;
}

async function acl(db) {
  return normalize((await db.query(`SELECT
    CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE grantee.rolname::text END AS grantee,
    grantor.rolname::text AS grantor, a.privilege_type AS privilege, a.is_grantable AS grantable
    FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
    LEFT JOIN pg_roles grantee ON grantee.oid = a.grantee
    JOIN pg_roles grantor ON grantor.oid = a.grantor
    WHERE c.oid = 'public.spatial_ref_sys'::regclass`)).rows);
}

async function invariantSnapshot(db) {
  return {
    rows: (await db.query('SELECT * FROM public.spatial_ref_sys ORDER BY srid')).rows,
    relation: (await db.query(`SELECT c.relowner::regrole::text AS owner, c.relkind,
      c.relrowsecurity, c.relforcerowsecurity FROM pg_class c
      WHERE c.oid = 'public.spatial_ref_sys'::regclass`)).rows,
    extension: (await db.query(`SELECT e.extname, e.extowner::regrole::text AS owner,
      e.extnamespace::regnamespace::text AS namespace, e.extversion, e.extrelocatable,
      e.extconfig, e.extcondition, d.deptype FROM pg_extension e JOIN pg_depend d ON d.refobjid=e.oid
      WHERE d.classid='pg_class'::regclass AND d.objid='public.spatial_ref_sys'::regclass
        AND d.objsubid=0 AND d.refclassid='pg_extension'::regclass AND d.deptype='e'`)).rows,
    policies: (await db.query("SELECT policyname, roles::text, cmd, qual, with_check FROM pg_policies WHERE schemaname='public' AND tablename='spatial_ref_sys' ORDER BY policyname")).rows,
    columnAcl: (await db.query("SELECT attnum,attacl::text FROM pg_attribute WHERE attrelid='public.spatial_ref_sys'::regclass AND attnum>0 ORDER BY attnum")).rows,
    defaults: (await db.query('SELECT defaclrole::regrole::text,defaclnamespace::regnamespace::text,defaclobjtype,defaclacl::text FROM pg_default_acl ORDER BY 1,2,3')).rows,
    schemaAcl: (await db.query("SELECT nspname,nspacl::text FROM pg_namespace WHERE nspname IN ('public','fixture_scratch') ORDER BY nspname")).rows,
  };
}

async function effective(db) {
  return (await db.query(`SELECT role_name, privilege,
    has_table_privilege(role_name,'public.spatial_ref_sys',privilege) AS allowed
    FROM (VALUES ('anon'::text),('authenticated')) roles(role_name)
    CROSS JOIN (VALUES ('INSERT'::text),('UPDATE'),('DELETE'),('TRUNCATE'),
      ('REFERENCES'),('TRIGGER'),('MAINTAIN')) privileges(privilege)
    ORDER BY role_name, privilege`)).rows;
}

async function execute(db, sql, role = 'supabase_admin') {
  // Role changes exist ONLY in this isolated synthetic fixture, never operator SQL.
  await db.exec('SET ROLE ' + role);
  try { await db.exec(sql); }
  catch (error) { await db.exec('ROLLBACK'); throw error; }
  finally { await db.exec('RESET ROLE'); }
}

async function underRole(db, role, sql) {
  await db.exec('BEGIN; SET LOCAL ROLE ' + role);
  try {
    let result;
    for (const statement of Array.isArray(sql) ? sql : [sql]) result = await db.query(statement);
    return result;
  }
  finally { await db.exec('ROLLBACK'); }
}

async function denied(db, role, sql) {
  try { await underRole(db, role, sql); return false; }
  catch (error) { if (error.code !== '42501') throw error; return true; }
}

async function guardCase(name, alter, pattern, sql = forward, role = 'supabase_admin') {
  const db = await fixture();
  try {
    await alter(db);
    const before = { acl: await acl(db), invariants: await invariantSnapshot(db) };
    let rejected = false;
    try { await execute(db, sql, role); }
    catch (error) { if (!pattern.test(error.message)) throw error; rejected = true; }
    assert.equal(rejected, true, name + ': expected guarded rejection');
    check(name + ' and preserves the full pre-attempt state',
      { acl: await acl(db), invariants: await invariantSnapshot(db) }, before);
  } finally { await db.close(); }
}

try {
  check('Source inventory has 41 entries; precisely 14 are targeted and 27 preserved',
    [baselineExpected.length, baselineExpected.length - restrictedExpected.length, restrictedExpected.length], [41, 14, 27]);
  check('Operator SQL has no role switching, RLS/owner/extension mutation, blanket revoke or grant option',
    [forwardOriginal, rollbackOriginal].some(sql => /\bSET\s+(?:LOCAL\s+)?ROLE\b|\bALTER\s+(?:ROLE|TABLE|EXTENSION|DEFAULT)\b|\bREVOKE\s+ALL\b|\bWITH\s+GRANT\s+OPTION\b/i.test(sql)), false);
  active = await fixture();
  check('Fixture reproduces every observed grantor, grantee, privilege and grantability bit', await acl(active), baselineExpected);
  const originalInvariants = await invariantSnapshot(active);
  check('Both synthetic client roles initially hold all seven targeted effective privileges',
    (await effective(active)).map(row => row.allowed), Array(14).fill(true));
  check('Synthetic anon can truncate the reference table before hardening; transaction is rolled back',
    (await underRole(active, 'anon', ['TRUNCATE public.spatial_ref_sys', 'SELECT count(*)::int AS count FROM public.spatial_ref_sys'])).rows, [{ count: 0 }]);

  await execute(active, forward);
  check('Forward removes exactly 14 entries and preserves the other 27 exactly', await acl(active), restrictedExpected);
  check('All 14 targeted effective privileges are absent after forward',
    (await effective(active)).map(row => row.allowed), Array(14).fill(false));
  check('Forward preserves all rows, owner, extension membership/metadata, RLS, policies, schema and future grants',
    await invariantSnapshot(active), originalInvariants);
  for (const role of ['anon', 'authenticated']) {
    check(role + ' SELECT still returns both synthetic reference rows',
      (await underRole(active, role, 'SELECT srid FROM public.spatial_ref_sys ORDER BY srid')).rows, [{ srid: 3857 }, { srid: 4326 }]);
    for (const [operation, sql] of [
      ['INSERT', "INSERT INTO public.spatial_ref_sys VALUES (9999,'FIXTURE',9999,'new','new')"],
      ['UPDATE', "UPDATE public.spatial_ref_sys SET auth_name='changed' WHERE srid=4326"],
      ['DELETE', 'DELETE FROM public.spatial_ref_sys WHERE srid=4326'],
      ['TRUNCATE', 'TRUNCATE public.spatial_ref_sys'],
      ['TRIGGER', 'CREATE TRIGGER fixture_forbidden BEFORE INSERT ON public.spatial_ref_sys FOR EACH ROW EXECUTE FUNCTION public.fixture_trigger()'],
      ['REFERENCES', 'CREATE TABLE fixture_scratch.forbidden_reference (srid integer REFERENCES public.spatial_ref_sys(srid))'],
    ]) check(role + ' ' + operation + ' is denied on synthetic objects after hardening', await denied(active, role, sql), true);
  }
  check('Non-target service_role retains its existing reference-data UPDATE privilege',
    (await underRole(active, 'service_role', "UPDATE public.spatial_ref_sys SET auth_name='fixture service change' WHERE srid=4326 RETURNING srid")).rows, [{ srid: 4326 }]);
  await execute(active, forward);
  check('Forward is idempotent on the exact reviewed hardened state', await acl(active), restrictedExpected);
  await execute(active, rollback);
  check('Rollback restores all 41 original ACL entries including original grantor and grantability', await acl(active), baselineExpected);
  check('Rollback preserves all non-ACL invariants and synthetic data', await invariantSnapshot(active), originalInvariants);
  await execute(active, rollback);
  check('Rollback is idempotent on the exact original state', await acl(active), baselineExpected);
  await active.close(); active = undefined;

  await guardCase('Unmodified production PostGIS guard refuses the plpgsql stand-in', async () => {}, /PostGIS extension membership/, forwardOriginal);
  await guardCase('Nonowner SQL actor with inherited table rights but no owner/grant authority is rejected', async db => {
    const row = (await underRole(db, 'fixture_sql_actor', `SELECT
      (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS superuser,
      pg_has_role(current_user,'supabase_admin','USAGE') AS owner_usage,
      has_table_privilege(current_user,'public.spatial_ref_sys','UPDATE') AS update_allowed,
      has_table_privilege(current_user,'public.spatial_ref_sys','UPDATE WITH GRANT OPTION') AS update_grant_option`)).rows[0];
    assert.deepEqual(row, { superuser: false, owner_usage: false, update_allowed: true, update_grant_option: false });
  }, /Owner\/operator intervention required/, forward, 'fixture_sql_actor');
  await guardCase('Changed table owner is rejected', db => db.exec('ALTER TABLE public.spatial_ref_sys OWNER TO postgres'), /ownership.*drift/, forward, 'postgres');
  await guardCase('Changed RLS state is rejected', db => db.exec('ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY'), /RLS drift/);
  await guardCase('New policy is rejected even when RLS is disabled', db => db.exec('CREATE POLICY fixture_unreviewed ON public.spatial_ref_sys FOR SELECT TO anon USING (true)'), /row policy drift/);
  await guardCase('Removed extension membership is rejected', db => db.exec('ALTER EXTENSION plpgsql DROP TABLE public.spatial_ref_sys'), /PostGIS extension membership/);
  await guardCase('Missing preserved SELECT grant is rejected', db => db.exec('REVOKE SELECT ON public.spatial_ref_sys FROM anon'), /ACL drift/);
  await guardCase('Unexpected table grantability is rejected', db => db.exec('GRANT UPDATE ON public.spatial_ref_sys TO anon WITH GRANT OPTION'), /ACL drift/);
  await guardCase('Any unreviewed column ACL is rejected before table REVOKE', db => db.exec('GRANT SELECT (srid) ON public.spatial_ref_sys TO anon'), /Column ACLs require separate review/);
  await guardCase('Inherited client write access aborts and rolls back the entire forward change', db => db.exec('GRANT service_role TO anon'), /unexpected effective .* privilege for anon/);
  await guardCase('Rollback refuses drift in the hardened ACL', async db => {
    await execute(db, forward);
    await db.exec('REVOKE SELECT ON public.spatial_ref_sys FROM anon');
  }, /ACL drift/, rollback);

  const report = {
    status: 'PASS', environment: `PGlite0.5.11 / PostgreSQL${version}; in-memory synthetic data`,
    tests: results.length, passed: results.length, failed: 0,
    source_acl_entries: 41, target_entries: 14, preserved_entries: 27,
    sql_sha256: { forward: createHash('sha256').update(forwardOriginal).digest('hex'), rollback: createHash('sha256').update(rollbackOriginal).digest('hex') },
    production_mutations: false, actual_postgis_loaded: false,
    fixture_adaptation: 'Only expected extension-name literal postgis→plpgsql for positive cases; original production guard tested unchanged as a rejecting case. Role switching occurs only inside isolated fixtures.',
    limits: 'No hosted PostGIS transforms, production API, operator connectivity, lock contention or concurrent DDL was exercised.',
    results,
  };
  await writeFile(new URL('./acl-fixture-test-results.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, tests: report.tests, passed: report.passed, failed: report.failed, environment: report.environment }));
} catch (error) {
  const failure = { status: 'FAIL', message: error.message, code: error.code ?? null, passed_before_failure: results.length, results };
  await writeFile(new URL('./acl-fixture-test-results.json', import.meta.url), JSON.stringify(failure, null, 2) + '\n');
  console.error(JSON.stringify({ status: failure.status, message: failure.message, code: failure.code, passed_before_failure: failure.passed_before_failure }));
  process.exitCode = 1;
} finally {
  if (active) await active.close();
}
