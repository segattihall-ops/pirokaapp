# Risk register

**Status of this register: CREATED 2026-10-23.** Owner: Gleicimar.

Likelihood and impact are not scored. No production metric was collected for this file. Each row points at a launch gate. "Open" means the gate is not LIVE.

| Risk | Why it is still open | Gate |
|---|---|---|
| `public.spatial_ref_sys` is in `public` with RLS off, and `anon` / `authenticated` hold write privileges, not only `SELECT`. Supabase names the RLS class of finding `rls_disabled_in_public`. | Draft PR #46 has the operator SQL and a synthetic fixture. Its own note says production SQL has not been applied and the current database role cannot revoke the owner's grants. This pass did not re-query the advisor. | PRK-001 |
| A member is charged, or a new subscription starts, while the owner decision is not to charge. | The code gate is on `main` (PR #49) and is off unless `BILLING_ENABLED` is exactly `true`. The Vercel value was not read. `OPEN_ENDED` all-access is a different switch and does not charge. | PRK-002 |
| A private photo is still world-readable because the storage bucket is public and object keys are predictable. | Signed URLs shipped in PR #28. `update storage.buckets set public = false where id = 'photos'` has not been confirmed. | PRK-003 |
| A safety report, payment failure, or error spike is only a server log line, so nobody sees it. | `main` alerts only when `OPS_WEBHOOK_URL` is set. Email is open PR #50. Neither channel was confirmed in production. | PRK-004 |
| Terms, privacy, 2257, CSAM reporting, and law-enforcement handling are used without a lawyer having approved them. | The owner turned the draft banner off on 2026-10-18. `docs/legal-review/README.md` still says draft and not legal advice. | PRK-005 |
| The 2257 custodian address `compliance@piroka.app` (and `privacy@piroka.app` on the privacy page) cannot receive mail because `piroka.app` is not in DNS. | A lookup on 2026-10-23 returned NXDOMAIN for A, NS, MX, and SOA. The pages still name that domain (`lib/help-content.ts`). | PRK-006 |
| Someone under 18 completes the gate, or the age check is the non-proving `local` provider. | `docs/age-verification-test-plan.md` has no recorded run. The plan still says Persona. The code prefers Didit when `DIDIT_API_KEY` is set, and refuses `local` in production. Production provider was not re-read. The 2026-10-18 status line that said "age ok (Didit)" is historical. | PRK-007 |
| A map pin sits on top of the member's true position, or a moving pin can be averaged back to it. | The 0–800 m disc is replaced in this branch by a 250–800 m annulus tied to the stable seed. Not deployed. Routes that publish pins were reviewed and do not select `true_geo` (see the unit test). | PRK-008 |
| An under-18 or threat report sits in the queue because the severity chip is Low, or staff handle CSAM by downloading it. | The runbook records the chip bug, the lack of auto-suspend, and a counsel-gated CSAM path. It has not been drilled. | PRK-009 |
| A migration or a policy for the other product in the same Supabase project changes PIROKA data, or the reverse. | `docs/GO_LIVE.md` §3.1. Not split out. Not re-queried. | PRK-010 |
| Launch state lives in chat and in old inspection notes, so a gate is called done because a document is stale. | This directory is the scorecard. It is new and not owner-approved. `docs/GO_LIVE.md` had a stale advisor sentence and a stale billing cause; those sentences were corrected without calling the service live. | PRK-011 |
| English-only UI, a failing end-to-end suite, or an unverified Vercel domain ships as if it were checked. | `app/layout.tsx` hardcodes `lang="en"` while `i18n.config.ts` lists `en`, `pt-BR`, and `es`. The 2026-10-18 e2e note was 80 passed and 11 failed; this pass did not re-run that suite. Vercel domain verification was not opened. | PRK-012 |
