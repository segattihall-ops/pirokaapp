# Launch gates

**Status of this register: CREATED 2026-10-23.** Owner of every gate: Gleicimar.

PR #49 and PR #50 are merged on `main`. This branch did not merge, deploy, or change Vercel, Supabase, PayPal, or production data. Draft PR #46 was not edited. Only PRK-002 is marked LIVE, from a production `/api/status` reading on 2026-10-23.

## What a status means

The word is how far the **remedy** has gone, not a claim that production was measured.

| Status | Meaning |
|---|---|
| CREATED | The gap is written down. |
| VALIDATED | The gap was checked against the repo or a dated observation. The remedy is not in place. |
| APPROVED | The owner has accepted the remedy. It is not necessarily merged. |
| IMPLEMENTED | The remedy is on `main`. |
| TESTED | A test for the remedy passed. Not the same as a production check. |
| LIVE | Confirmed on the production project after deploy. |

| ID | Gate | Status | Evidence used | Still the owner's |
|---|---|---|---|---|
| PRK-001 | Supabase `rls_disabled_in_public` on `public.spatial_ref_sys`, and the client write grants on that table | VALIDATED | Draft PR #46. Catalog snapshot 2026-10-21 14:54:49 UTC, project `clwqmzgoqfqibnfevhyb`: RLS off, `anon` and `authenticated` hold all eight table privileges. The PR says 38 synthetic checks passed and that production SQL was not applied. This pass did not re-run the fixture or the advisor. `docs/GO_LIVE.md` (2026-10-18) said there was no critical finding; that sentence is withdrawn. | Run the preflight, then the forward SQL in PR #46, as `supabase_admin` or a superuser. Do not run it from this branch. Re-read the advisor after. The PR says an RLS-disabled finding can remain because the proposal keeps the extension table's RLS off on purpose; the acceptance check is the privilege change. |
| PRK-002 | No charging at launch (`BILLING_ENABLED`) | LIVE | Owner decision 2026-10-23. Merged PR #49 (`beed330`). On 2026-10-23, production `/api/status` reported billing off with detail `billing disabled by BILLING_ENABLED`. Checkout routes return 503 unless the variable is exactly `true`. `lib/billing/launch.ts` `OPEN_ENDED` is a separate switch and stays on. | Leave `BILLING_ENABLED` unset. Do not set it to `true`. |
| PRK-003 | `photos` bucket is private | VALIDATED | PR #28 (merged) mints signed URLs and documents the predictable key. `docs/GO_LIVE.md` §3.2 still has the owner SQL. The bucket flag was not selected. | After the signed-URL deploy is the one serving traffic, run `update storage.buckets set public = false where id = 'photos';` and confirm a private album URL 403s without a signature. |
| PRK-004 | Ops alerts reach a person | IMPLEMENTED | Owner decision 2026-10-23. PR #50 squash-merged (`0db1d63`): `OPS_ALERT_EMAIL` and optional `OPS_WEBHOOK_URL`. The alerts code is deployed. As of 2026-10-23 18:40 UTC, `OPS_ALERT_EMAIL` was not visible in production, so the email channel is not confirmed and this row is not LIVE. | Set `OPS_ALERT_EMAIL` (one address, or several separated by commas) and redeploy. Then confirm `/api/status` alerts detail is `email` or `email + webhook`. |
| PRK-005 | Counsel sign-off | CREATED | `docs/legal-review/README.md` is explicit: draft, not legal advice, not published. The 2026-10-18 banner removal was an owner authorisation, and `draft: false` is what the code has now. | Counsel reviews the legal center, including 2257, CSAM, and legal requests, before those pages are treated as final. |
| PRK-006 | `piroka.app` does not exist in DNS, while the 2257 page names `compliance@piroka.app` | VALIDATED | Lookup on 2026-10-23: NXDOMAIN for A, NS, MX, and SOA of `piroka.app` (authority is the `.app` TLD). `lib/help-content.ts` custodian line and the privacy contact use that domain. | Register and host the name, or change the published addresses, after counsel agrees the custodian line. |
| PRK-007 | Age-verification test plan has not been run | CREATED | `docs/age-verification-test-plan.md` says to record date, preview URL, and inquiry id. No result file exists. The plan's steps are Persona. The app's provider order is Didit, then Persona, then Yoti, then `local` (`lib/age/index.ts`). | Run the plan on a non-production host against the provider you will actually use. Do not run it against the live domain. Record the result. Do not use a real document. |
| PRK-008 | Displayed position is never within a few metres of the true point, and the seed does not jitter | TESTED | `lib/geo/fuzz.ts` annulus 250–800 m, offset from the stable seed only. `lib/geo/fuzz.test.ts` (floor across seeds and latitudes, stability, no re-roll on a new fix). `tests/no-raw-coords.test.mjs` (nearby, area, trips do not read `true_geo`). | Deploy this branch after review. Not deployed from here. Map-presence Playwright was not re-run in this pass; that workflow starts the app. The presence spec does not import `fuzzLocation`. |
| PRK-009 | Trust & Safety runbook | CREATED | `docs/trust-safety/RUNBOOK.md`, written from `app/api/safety/*`, `app/api/help/report`, `app/api/admin/reports`, `app/api/admin/mod-action`, `app/api/admin/appeals`, and the admin reports page. | Read it, drill under-18 (suspend and Require ID; the product does not do either automatically), and have counsel mark sections 7 and 10. The severity chip is wrong for in-app reason slugs. |
| PRK-010 | Shared Supabase project | VALIDATED | `docs/GO_LIVE.md` §3.1: other system's tables, and `activity_log` from migration 025 skipped. Not queried again. | Move PIROKA to its own project when you choose to. Until then, do not apply another product's migrations here. |
| PRK-011 | Registers exist | CREATED | This directory: `DECISIONS.md`, `RISKS.md`, `LAUNCH_GATES.md`, `KPIS.md`. | Accept or correct the rows. They are not an approval to launch. |
| PRK-012 | i18n, end-to-end suite, and Vercel domain verification | VALIDATED | `i18n.config.ts` lists `en`, `pt-BR`, `es`. `app/layout.tsx` is `lang="en"`. A 2026-10-01 commit reverted next-intl middleware. `docs/GO_LIVE.md` recorded 11 failing e2e tests on 2026-10-18; not re-run. Vercel domain verification was not opened. | Finish the locales you intend to ship, get the e2e suite green or delete the stale tests, and confirm the production domain in Vercel yourself. |
