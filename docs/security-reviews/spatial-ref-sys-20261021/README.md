# PIROKA spatial reference table: client permission review

**Status: prepared and locally verified; production change remains blocked by owner/operator access.**

This is a documentation and test proposal for the existing PIROKA access-control backlog. It does not complete the broader launch-gates outcome. No production SQL, role changes, branch writes, or pull request creation were performed while preparing it. These files belong under a documentation directory, outside automatic migrations.

## Verified source and exact scope

The sanitized catalog snapshot was collected on **2026-10-21 at 14:54:49 UTC** from PIROKA project **`clwqmzgoqfqibnfevhyb`**. The repository baseline inspected for this proposal is **`segattihall-ops/pirokaapp` at `b43300a753892555417f7e6e0a057da1d4ee66ee`**. Its `CLAUDE.md` was read; this change does not affect the fixed product design.

The target is the ordinary table `public.spatial_ref_sys`, owned by `supabase_admin` and belonging to the `postgis` extension. RLS and forced RLS are false, and the source reports zero policies. The table ACL contains **41 entries**, all recorded with `supabase_admin` as grantor and no stored grant-option flag. Ownership still carries implicit grant authority; the owner's stored ACL flag does not remove that authority.[1]

| Grantee | Before | Proposed after | Entries preserved |
|---|---|---|---:|
| `PUBLIC` | `SELECT` | `SELECT` | 1 |
| `supabase_admin` | All eight table privileges | Same eight | 8 |
| `postgres` | All eight table privileges | Same eight | 8 |
| `service_role` | All eight table privileges | Same eight | 8 |
| `anon` | All eight table privileges | `SELECT` | 1 |
| `authenticated` | All eight table privileges | `SELECT` | 1 |
| **Total** | **41 entries** | **27 entries** | **27** |

The eight table privileges are `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`, and `MAINTAIN`.[2] The proposed removal is exactly **seven non-SELECT privileges × two client roles = 14 entries**. It retains the other 27 entries, including their grantor and grantability values. It does not change schema grants, future default grants, role memberships, table ownership, extension configuration, policies, RLS settings, rows, or any other table.

The supplied snapshot independently confirms effective client `SELECT`, `INSERT`, `UPDATE`, and `DELETE`. The complete ACL also records the four additional privileges for each client role. The forward postcondition checks all seven targeted effective privileges, so inherited access cannot be mistaken for successful hardening. No production write or public exploit was attempted.

## Why the current connector cannot apply this proposal

The observed SQL actor is `postgres`, with `rolsuper = false`, no immediately available `supabase_admin` role privileges, and no `UPDATE` or `TRUNCATE` grant option on this table. Its ability to create roles is not ownership or authority to revoke the owner's grants. PostgreSQL may issue a warning while a nonowner revoke removes nothing; a command returning without an exception is insufficient evidence of remediation.[3]

The proposal therefore rejects any actor other than the actual `supabase_admin` owner or a genuine superuser **before taking a table lock or changing an ACL**. A provider-authorized owner/operator must execute through an established administrative path after separate approval. User approval alone does not give the current connector the missing database authority. No role switching or elevation is included in the operator files.

## Files and their purpose

| File | Purpose |
|---|---|
| `observed-catalog.json` | Sanitized source evidence supplied by the parent audit |
| `column-acl-evidence.json` | Supplemental read-only proof of five columns and zero explicit column ACLs |
| `spatial_ref_sys.preflight.sql` | Read-only actor, relation, extension, column-ACL, complete ACL and effective-permission checks |
| `spatial_ref_sys.forward.sql` | Guarded transaction removing exactly the 14 reviewed client privileges |
| `spatial_ref_sys.rollback.sql` | Guarded transaction restoring exactly the 14 original entries if recovery is explicitly approved |
| `acl-fixture-test.mjs` | In-memory PostgreSQL fixture executing the operator SQL and meaningful permission checks |
| `acl-fixture-test-results.json` | All 38 local verification results and exact SQL SHA-256 hashes |
| `package.json`, `package-lock.json` | Isolated test dependency pinned to PGlite 0.5.11 |

## Forward transaction and protection against drift

The only permission mutation in the forward file is:

```sql
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.spatial_ref_sys FROM anon, authenticated RESTRICT;
```

It executes only after checking the owner/operator, exact relation, owner, extension membership, unchanged RLS flags, absent policies, and a complete ACL matching either the exact reviewed 41-entry state or the already hardened 27-entry state. Any other ACL fails closed, including a changed grantor, grant option, preserved SELECT grant, or additional entry.

It also refuses any explicit column ACL. Supplemental read-only metadata in `column-acl-evidence.json` verifies five live columns and zero explicit column ACLs. This avoids silently removing unreviewed column privileges as a side effect of a table-level revoke; PostgreSQL documents that such removal can occur.[3] A nonzero column-ACL result in preflight requires a fresh review. It is not permission to remove those grants.

The transaction uses a two-second lock timeout and a fifteen-second statement timeout. An `ACCESS EXCLUSIVE` lock provides a short, bounded maintenance window; it can temporarily block readers, so an operator must choose an appropriate window. A timeout is an abort, not an instruction to increase the limit automatically.

The postcondition compares the entire resulting ACL to the exact 27 entries. It rechecks table identity, ownership, RLS, policy absence, column ACLs, and the extension's metadata and membership. Both clients must retain effective SELECT and lose all seven effective targeted privileges. If inheritance still provides a targeted privilege, the whole transaction fails and rolls back. Role memberships are preserved for a separate investigation.[3][4]

The operation is idempotent only for the exact reviewed hardened state. It does not normalize arbitrary drift, suppress errors, or use `CASCADE`.

## Rollback and owner execution sequence

Rollback is a recovery action that deliberately restores the original broad client privileges. It requires its own explicit operator decision. It uses the same identity and state guards and restores only the seven named privileges to the same two roles, without grant options. It verifies the original 41 entries, original grantor, and preserved metadata before committing. Unexpected drift is a blocker; the rollback never uses `GRANT ALL`.

The operator sequence is:

1. Confirm the administrative connection targets PIROKA project `clwqmzgoqfqibnfevhyb`. SQL metadata in this package does not independently attest the hosted project ID. Obtain approval and an authorized owner/superuser execution path.
2. Run the read-only preflight, archive its fresh output, and compare it with the supplied source. Confirm zero column ACLs and the exact reviewed ownership, extension, RLS, policy and ACL state.
3. Independently review the two SQL files and their hashes from the passing fixture results. Retain the approved rollback file and source evidence.
4. Execute the complete forward transaction with error-stop behavior. Any error requires rollback and a new diagnosis; do not skip or weaken a guard. Do not retry an unavailable owner role through the current connector.
5. Run the preflight again. Verify the exact 27 ACL entries, effective SELECT for both client roles, and false for all 14 targeted effective role/privilege combinations.
6. Run existing read-only spatial lookups and application map/coordinate-conversion checks through the established authorized interfaces. Verify the preserved service-role path if the application relies on it. Do not send production write probes as a completion test.
7. If a verified regression requires restoration, the owner/operator may use the separately approved rollback, then repeat the ACL and application read checks. Record the recovered state and remaining exposure.

An RLS-disabled advisor finding may remain because this proposal intentionally preserves the extension table's RLS configuration. The acceptance criterion is the exact client-privilege correction, not a clean advisor dashboard. It also does not address the separate `pulse_snapshot()` migration-history concern.

## Local verification

**38 checks passed; zero failed**, using PGlite **0.5.11** running PostgreSQL **18.6** with only synthetic in-memory rows. Run the isolated fixture with:

```sh
npm ci --ignore-scripts
npm test
```

The fixture reproduces all 41 ACL entries from the source, including grantor and grantability. It proves the 14-entry removal and exact rollback, retained client SELECT and service-role UPDATE, denial of client INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER/REFERENCES, and absence of all seven effective client privileges including MAINTAIN. It verifies unchanged rows, extension metadata/membership, owner, RLS, policies, schema grants and future defaults. It checks idempotence and refusal of owner, RLS, policy, extension, ACL, grant-option and column-ACL drift. A client inheriting service-role writes causes the postcondition to fail and restores the entire pre-attempt state.

PGlite does not load PostGIS in this test. The synthetic table belongs to the native `plpgsql` extension, and positive tests replace only the expected extension-name literal `postgis` with `plpgsql`. The extension membership guard, privilege statements and all other checks remain active. A separate negative test runs the original PostGIS guard unchanged and verifies rejection. Role switching appears only inside this isolated fixture to test roles; it is absent from both operator files.

These results establish PostgreSQL ACL behavior and guard behavior in the fixture. They do not establish hosted owner access, PostGIS spatial semantics, production API behavior, lock contention, concurrent DDL safety, or production remediation. The initial fixture attempt hit a multi-command prepared-statement restriction; the harness was corrected to execute those two statements sequentially, and the complete suite then passed. No operator SQL was weakened to resolve that harness failure.

## Resume checkpoint

The parent reviewer approved the documentation and fixture for a draft documentation PR. The published file set and head still require final readback. The production correction remains **BLOCKED** on authorized owner/operator execution and later live verification. Attach these artifacts to the existing PIROKA access-control/gates task; do not add a duplicate outcome or mark the broader project complete.

## Primary references

[1] PostgreSQL 18 — Privileges: https://www.postgresql.org/docs/18/ddl-priv.html

[2] PostgreSQL 18 — GRANT: https://www.postgresql.org/docs/18/sql-grant.html

[3] PostgreSQL 18 — REVOKE, including nonowner behavior, inherited rights and column privileges: https://www.postgresql.org/docs/18/sql-revoke.html

[4] PostgreSQL 18 — System information functions (`has_table_privilege`, `pg_has_role`, `aclexplode`): https://www.postgresql.org/docs/18/functions-info.html
