-- FORWARD: OWNER REVIEW ONLY; NOT AN AUTOMATIC MIGRATION.
-- Target: PIROKA / clwqmzgoqfqibnfevhyb / public.spatial_ref_sys.
-- Requires separate approval and a provider-authorized owner/superuser session.
-- No role switching, ownership changes, RLS changes, extension changes, or DML.
-- Baseline: 41 exact ACL entries. Result: 27, preserving every non-target entry.

BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';
SET LOCAL search_path = pg_catalog;

DO $spatial_acl_review$
DECLARE
  v_expected_extension constant name := 'postgis';
  v_expected_effective constant boolean := false;
  v_table oid;
  v_owner name;
  v_superuser boolean;
  v_extension oid;
  v_extension_before jsonb;
  v_extension_after jsonb;
  v_meta_before jsonb;
  v_meta_after jsonb;
  v_expected_full jsonb;
  v_expected_restricted jsonb;
  v_expected_final jsonb;
  v_acl_before jsonb;
  v_acl_after jsonb;
  v_role text;
  v_privilege text;
BEGIN
  SELECT rolsuper INTO v_superuser FROM pg_roles WHERE rolname = current_user;
  IF current_user <> 'supabase_admin' AND NOT coalesce(v_superuser, false) THEN
    RAISE EXCEPTION 'Owner/operator intervention required: this SQL actor is neither supabase_admin nor a superuser'
      USING ERRCODE = '42501';
  END IF;

  v_table := to_regclass('public.spatial_ref_sys');
  IF v_table IS NULL THEN
    RAISE EXCEPTION 'Expected table public.spatial_ref_sys is absent' USING ERRCODE = '55000';
  END IF;

  -- Bound the maintenance window; a busy table causes an error, not a long wait.
  LOCK TABLE public.spatial_ref_sys IN ACCESS EXCLUSIVE MODE;

  SELECT r.rolname,
    jsonb_build_object('oid', c.oid, 'owner', c.relowner, 'kind', c.relkind,
      'rls', c.relrowsecurity, 'force_rls', c.relforcerowsecurity)
  INTO v_owner, v_meta_before
  FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner WHERE c.oid = v_table;
  IF v_owner <> 'supabase_admin' OR v_meta_before->>'kind' <> 'r'
    OR (v_meta_before->>'rls')::boolean OR (v_meta_before->>'force_rls')::boolean THEN
    RAISE EXCEPTION 'Unreviewed ownership, relation kind or RLS drift' USING ERRCODE = '55000';
  END IF;

  SELECT e.oid, to_jsonb(e) INTO v_extension, v_extension_before
  FROM pg_depend d JOIN pg_extension e ON e.oid = d.refobjid
  WHERE d.classid = 'pg_class'::regclass AND d.objid = v_table AND d.objsubid = 0
    AND d.refclassid = 'pg_extension'::regclass AND d.deptype = 'e'
    AND e.extname = v_expected_extension;
  IF v_extension IS NULL THEN
    RAISE EXCEPTION 'Expected PostGIS extension membership is absent' USING ERRCODE = '55000';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = v_table) THEN
    RAISE EXCEPTION 'Unreviewed row policy drift' USING ERRCODE = '55000';
  END IF;
  -- PostgreSQL table REVOKE can also remove corresponding column grants.
  -- No column ACL was supplied in the source inventory; refuse any such state.
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = v_table AND attnum > 0
    AND cardinality(attacl) > 0) THEN
    RAISE EXCEPTION 'Column ACLs require separate review before table privilege changes' USING ERRCODE = '55000';
  END IF;

  WITH roles(grantee) AS (
    VALUES ('supabase_admin'::text), ('postgres'), ('anon'), ('authenticated'), ('service_role')
  ), privileges(privilege) AS (
    VALUES ('SELECT'::text), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'),
      ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')
  ), entries AS (
    SELECT grantee, 'supabase_admin'::text AS grantor, privilege, false AS grantable
      FROM roles CROSS JOIN privileges
    UNION ALL SELECT 'PUBLIC', 'supabase_admin', 'SELECT', false
  )
  SELECT jsonb_agg(jsonb_build_object('grantee', grantee, 'grantor', grantor,
    'privilege', privilege, 'grantable', grantable)
    ORDER BY grantee COLLATE "C", grantor COLLATE "C", privilege COLLATE "C", grantable)
  INTO v_expected_full FROM entries;

  SELECT jsonb_agg(entry ORDER BY entry->>'grantee' COLLATE "C",
    entry->>'grantor' COLLATE "C", entry->>'privilege' COLLATE "C", (entry->>'grantable')::boolean)
  INTO v_expected_restricted FROM jsonb_array_elements(v_expected_full) entry
  WHERE NOT (entry->>'grantee' IN ('anon', 'authenticated') AND entry->>'privilege' <> 'SELECT');
  v_expected_final := v_expected_restricted;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'grantee', CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE grantee.rolname::text END,
    'grantor', grantor.rolname::text, 'privilege', a.privilege_type, 'grantable', a.is_grantable)
    ORDER BY (CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE grantee.rolname::text END) COLLATE "C",
      grantor.rolname::text COLLATE "C", a.privilege_type COLLATE "C", a.is_grantable), '[]'::jsonb)
  INTO v_acl_before
  FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
    LEFT JOIN pg_roles grantee ON grantee.oid = a.grantee
    JOIN pg_roles grantor ON grantor.oid = a.grantor WHERE c.oid = v_table;
  IF v_acl_before IS DISTINCT FROM v_expected_full
    AND v_acl_before IS DISTINCT FROM v_expected_restricted THEN
    RAISE EXCEPTION 'ACL drift: expected exactly the reviewed 41 entries or the exact hardened 27 entries'
      USING ERRCODE = '55000';
  END IF;

  IF v_acl_before IS DISTINCT FROM v_expected_final THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
      ON TABLE public.spatial_ref_sys FROM anon, authenticated RESTRICT;
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'grantee', CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE grantee.rolname::text END,
    'grantor', grantor.rolname::text, 'privilege', a.privilege_type, 'grantable', a.is_grantable)
    ORDER BY (CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE grantee.rolname::text END) COLLATE "C",
      grantor.rolname::text COLLATE "C", a.privilege_type COLLATE "C", a.is_grantable), '[]'::jsonb)
  INTO v_acl_after
  FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
    LEFT JOIN pg_roles grantee ON grantee.oid = a.grantee
    JOIN pg_roles grantor ON grantor.oid = a.grantor WHERE c.oid = v_table;
  IF v_acl_after IS DISTINCT FROM v_expected_final THEN
    RAISE EXCEPTION 'Postcondition failed: exact target ACL was not achieved; transaction must roll back'
      USING ERRCODE = '55000';
  END IF;

  SELECT jsonb_build_object('oid', c.oid, 'owner', c.relowner, 'kind', c.relkind,
    'rls', c.relrowsecurity, 'force_rls', c.relforcerowsecurity)
  INTO v_meta_after FROM pg_class c WHERE c.oid = v_table;
  SELECT to_jsonb(e) INTO v_extension_after FROM pg_extension e WHERE e.oid = v_extension;
  IF v_meta_after IS DISTINCT FROM v_meta_before OR v_extension_after IS DISTINCT FROM v_extension_before
    OR NOT EXISTS (SELECT 1 FROM pg_depend WHERE classid = 'pg_class'::regclass AND objid = v_table
      AND objsubid = 0 AND refclassid = 'pg_extension'::regclass AND refobjid = v_extension AND deptype = 'e')
    OR EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = v_table)
    OR EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = v_table AND attnum > 0 AND cardinality(attacl) > 0) THEN
    RAISE EXCEPTION 'Postcondition failed: extension, ownership, RLS, policy or column ACL changed'
      USING ERRCODE = '55000';
  END IF;

  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF has_table_privilege(v_role, v_table, 'SELECT') IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Postcondition failed: SELECT no longer available to %', v_role USING ERRCODE = '55000';
    END IF;
    FOREACH v_privilege IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'] LOOP
      IF has_table_privilege(v_role, v_table, v_privilege) IS DISTINCT FROM v_expected_effective THEN
        RAISE EXCEPTION 'Postcondition failed: unexpected effective % privilege for %; inspect inherited grants',
          v_privilege, v_role USING ERRCODE = '55000';
      END IF;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'Verified % ACL entries; owner, extension, SELECT and all non-target grants preserved',
    jsonb_array_length(v_acl_after);
END
$spatial_acl_review$;

COMMIT;
