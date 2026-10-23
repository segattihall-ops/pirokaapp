# Decision register

**Status of this register: CREATED 2026-10-23.** Owner: Gleicimar.

A decision stays in this file when it constrains launch. Dates are the commit or document dates in the repository, or the date the owner stated the decision. This file does not record production settings that were not read from Vercel, Supabase, or PayPal.

| Date | Decision | Where it lives | Where it stands |
|---|---|---|---|
| 2026-09-30 | True member coordinates stay on the server. Other members see a fuzzed public position. | PR #6; `README.md` rule 1; `lib/geo/fuzz.ts` | In the repo. The offset floor is the 2026-10-23 row below. Not re-verified in production. |
| 2026-10-06 | The publication fuzz seed is kept across automatic recaptures so repeated reads cannot be averaged back to the true point. A new seed is only for a location row that has none. | PR #12; `lib/geo/fuzz-session.ts`; `app/api/me/location/route.ts`; `e2e/presence.spec.ts` | In the repo. |
| 2026-10-13 | Ops alerts go to `OPS_WEBHOOK_URL` when set, otherwise to the server log. | `0220744`; `lib/alerts/server.ts` | Superseded for the email channel by the 2026-10-23 row. The webhook path remains. |
| 2026-10-15 | Age checks are a provider decision. Didit (selfie estimate, ID fallback) is wired. Only a boolean and a method are stored. `local` is refused when `NODE_ENV` is production. | `fcbfb7f`; `lib/age/index.ts`; `lib/age/didit.ts` | In the repo. Which provider production uses was not re-read. |
| 2026-10-18 | The 18+ gate applies to `/api/*`, not only to pages. Unsigned-in-age routes outside the pre-gate list return 403. | PR #28; `middleware.ts` | Merged. Not re-tested against production in this pass. |
| 2026-10-18 | Private photos are served as short-lived signed URLs. Making the `photos` bucket private is a separate SQL step and was not part of the merge. | PR #28; `docs/GO_LIVE.md` §2 and §3.2 | Code merged. Bucket flag not confirmed. |
| 2026-10-18 | Owner authorised turning off the draft banner on Terms, Privacy, and the 2257 page (`draft: false`). That is not counsel sign-off. | `docs/GO_LIVE.md` §3; `lib/help-content.ts` | Banner flag is false in code. Counsel review is still open (`docs/legal-review/README.md`). |
| 2026-10-18 | The PIROKA Supabase project is shared with another system. Migration 025's `activity_log` was skipped on purpose. The note recommends a dedicated project later. | `docs/GO_LIVE.md` §3.1 | Recorded. Not done. This pass did not query the database. |
| 2026-10-18 | The area board stores a coarse cell, not an exact member fix. | PR #28; `app/api/area/messages/route.ts` (`Math.round(v * 100) / 100`) | In the repo. |
| 2026-10-19 | Launch all-access is open-ended. Feature checks treat every member as premium until `OPEN_ENDED` is turned off. This does not by itself charge anyone. | PR #34; `lib/billing/launch.ts` | In the repo. |
| 2026-10-21 | `pulse_snapshot()` may be executed only by the service role. | PR #44 | Merged. |
| 2026-10-23 | No charging at launch. New Plus/Premium checkout stays off unless `BILLING_ENABLED` is exactly `true`. PayPal keys may remain. Existing subscription webhooks, cancel, pause, resume, and receipts are not behind that flag. | Owner decision; merged PR #49; `lib/billing/enabled.ts` | Code is on `main`. This pass did not read Vercel, so it does not know the live variable. |
| 2026-10-23 | Ops alerts can go by email (`OPS_ALERT_EMAIL`), with report narratives kept out of the alert body. Webhook remains optional. | Owner decision; squash-merged PR #50 (`0db1d63`) | Code is on `main` and deployed. As of 2026-10-23 18:40 UTC, `OPS_ALERT_EMAIL` was not visible in production. |
| 2026-10-23 | The displayed map position is an annulus of 250–800 m around the true point, still a pure function of the stable seed. A disc from 0 m is not acceptable. Grid snap was not added: it does not guarantee a floor inside the 800 m cap. | This branch; `lib/geo/fuzz.ts` | In this branch. Unit-tested here. Not deployed. |

Items deliberately not decided here: counsel approval of the legal center, applying the `spatial_ref_sys` SQL in draft PR #46, flipping the photos bucket, DNS for `piroka.app`, and running the age-verification test plan.
