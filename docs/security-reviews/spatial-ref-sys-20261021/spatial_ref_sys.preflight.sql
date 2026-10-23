-- READ ONLY. Confirm the connection is PIROKA project clwqmzgoqfqibnfevhyb first.
BEGIN READ ONLY;

SELECT current_user AS sql_actor, r.rolsuper,
  pg_has_role(current_user, 'supabase_admin', 'USAGE') AS owner_role_privileges_available,
  has_table_privilege(current_user, 'public.spatial_ref_sys', 'UPDATE WITH GRANT OPTION') AS update_grant_option,
  has_table_privilege(current_user, 'public.spatial_ref_sys', 'TRUNCATE WITH GRANT OPTION') AS truncate_grant_option,
  current_setting('server_version') AS server_version
FROM pg_catalog.pg_roles r WHERE r.rolname = current_user;

SELECT c.oid::regclass AS relation, owner.rolname AS owner, c.relkind,
  c.relrowsecurity, c.relforcerowsecurity, e.extname, e.extversion,
  (SELECT count(*) FROM pg_catalog.pg_policy p WHERE p.polrelid = c.oid) AS policy_count,
  (SELECT count(*) FROM pg_catalog.pg_attribute a WHERE a.attrelid = c.oid
    AND a.attnum > 0 AND cardinality(a.attacl) > 0) AS columns_with_explicit_acl
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_roles owner ON owner.oid = c.relowner
LEFT JOIN pg_catalog.pg_depend d ON d.classid = 'pg_class'::regclass AND d.objid = c.oid
  AND d.objsubid = 0 AND d.refclassid = 'pg_extension'::regclass AND d.deptype = 'e'
LEFT JOIN pg_catalog.pg_extension e ON e.oid = d.refobjid
WHERE c.oid = to_regclass('public.spatial_ref_sys');

SELECT CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE grantee.rolname::text END AS grantee,
  grantor.rolname::text AS grantor, a.privilege_type AS privilege, a.is_grantable AS grantable
FROM pg_catalog.pg_class c
CROSS JOIN LATERAL pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) a
LEFT JOIN pg_catalog.pg_roles grantee ON grantee.oid = a.grantee
JOIN pg_catalog.pg_roles grantor ON grantor.oid = a.grantor
WHERE c.oid = to_regclass('public.spatial_ref_sys')
ORDER BY 1, 2, 3, 4;

SELECT role_name, privilege,
  has_table_privilege(role_name, 'public.spatial_ref_sys', privilege) AS effective
FROM (VALUES ('anon'::text), ('authenticated')) roles(role_name)
CROSS JOIN (VALUES ('SELECT'::text), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'),
  ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')) privileges(privilege)
ORDER BY role_name, privilege;

ROLLBACK;
