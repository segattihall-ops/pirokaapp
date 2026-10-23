# πroka — Go-live inspection

Full pre-launch pass over the app that is already serving **https://www.pirokaapp.com**
(Vercel project `pirokaapp`, Supabase project `PIROKA`). Sections 1 and 2 are the
**2026-10-18** inspection record. They were not re-run on 2026-10-23.

**2026-10-23 update.** This file is not a statement that the service is launch-ready or that
production was queried again. Current gate status is `docs/registers/LAUNCH_GATES.md`.
Billing and the advisor sentence below were stale; they are corrected here. No Vercel,
Supabase, or PayPal setting was read or changed for this update.

## Verdict

The code fixes from the 2026-10-18 inspection are on `main` (PR #28, merged). That is not a
launch approval. Open gates, including the advisor SQL, the photos bucket, counsel, DNS,
age-verification, and alerts, are listed in `docs/registers/LAUNCH_GATES.md`.

## Billing at launch

The owner decision on 2026-10-23 is that PIROKA does not charge at launch. In code, new
Plus/Premium checkouts stay **off** unless `BILLING_ENABLED` is exactly the string `true`
(merged PR #49). Leave that variable **unset** in Vercel until you decide to charge. PayPal
keys may stay in place. This update did not read the Vercel project, so it does not know
whether the variable is unset there.

With the flag unset or set to anything other than `true`:

- `/api/status` reports billing **off**, detail `billing disabled by BILLING_ENABLED`, even
  when PayPal keys are present.
- `POST /api/billing/checkout`, `/api/billing/subscribe`, and `/api/billing/change` return **503**
  and do not call PayPal.
- `GET /api/billing/status` reports `configured: false` and `billingEnabled: false`, so Me → Plan &
  billing shows “Billing not available yet” with no PayPal buttons and no upgrade CTA. The browser
  does not decide this from `NEXT_PUBLIC_PAYPAL_*` (those are fixed at build time).
- Webhooks, cancellation (including pause and resume), and receipts keep working for anyone who
  already has a subscription.

`OPEN_ENDED` launch access in `lib/billing/launch.ts` is a separate switch and stays on. It
grants features. It does not charge.

---

## 1. What was checked (2026-10-18)

These rows are the inspection record. They are not a fresh result.

| Area | Result on 2026-10-18 |
|---|---|
| `next build` / `tsc --noEmit` / `next lint` | Clean on the commits inspected that day. |
| Playwright e2e (local, demo mode) | 80 passed · 11 failed — the note that day attributed all 11 to stale tests or environment (expect `400` where routes now answer `401` first, need a local DB or `E2E_AUTH_TOKEN`, or test the SW in dev mode). Not re-run on 2026-10-23. |
| Production smoke (`e2e/smoke.full.spec.ts` against www) | Homepage ok. Sign-in was blocked for the headless browser by Cloudflare Turnstile. |
| Production probes | `/`, `/help/*`, `/e/*`, `/manifest.webmanifest` 200 · `/app`, `/admin` redirected at the gate · HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy present · apex → www 308. |
| `/api/status` | database ok · email ok (Resend) · push ok · age ok (Didit) · cron ok · billing off · ops alerts off (`OPS_WEBHOOK_URL` missing). The billing cause that day was written as missing PayPal keys. That cause is withdrawn: keys may or may not be present now, and the code hides checkout unless `BILLING_ENABLED` is exactly `true`. Alerts were not re-read. |
| Supabase security advisors | The 2026-10-18 note said there was no critical πroka finding, that 25 tables had RLS on and no policies, and that `spatial_ref_sys` was only PostGIS’s own table. **Do not use that sentence.** Draft PR #46 (catalog snapshot 2026-10-21, project `clwqmzgoqfqibnfevhyb`) records `public.spatial_ref_sys` with RLS disabled and with `anon` / `authenticated` holding every table privilege, not only `SELECT`. Supabase’s name for a public table without RLS is `rls_disabled_in_public`. The SQL in that PR has not been applied. This update did not re-query the advisor. |

---

## 2. Fixed in PR #28 (merged)

### Security
- **Private photos were world-readable.** The `photos` bucket was public and keys are predictable
  (`users/<uuid>/photos/<slot>.original.jpg`). Every photo link is now a **1-hour signed URL**
  minted by the route that already decides clear-vs-blur. The bucket is private only after the
  owner SQL in §3.2. That flip has not been confirmed.
- **18+ gate enforced on the API, not only on pages.** `middleware.ts` answers 403 on every
  `/api/*` route except the gate itself, auth, telemetry, public intake, account hygiene,
  webhooks and crons.
- Open redirect in `/auth/callback` (`?next=/\evil.com`) closed.
- PayPal: `custom_id` (set by the browser) could re-point another member’s subscription or let one
  payment unlock many accounts. Webhook and `/api/billing/subscribe` bind one subscription to
  one member. New checkout is additionally behind `BILLING_ENABLED` (PR #49).
- Rate limits on `/api/chat/start` and `/api/keys/bundle`.
- XP amounts and referral rewards are decided server-side.
- Hard-coded fallback secrets removed from demo auth and unsubscribe tokens.
- Area board stores a ~1 km grid cell instead of exact coordinates; radius bug (km vs m) fixed.
- Dead `next-auth` stack removed.

### Product
- Public **Report content** form persists to the Trust & Safety `reports` queue. The ops webhook
  is pinged when configured. On current `main` the public-report alert includes the narrative.
  Email alerts and narrative redaction are open PR #50, not merged.
- Upgrade buttons, help links, quick-exit, Pulse trends, checkout copy, admin seed data, and
  `?demo=1` behaviour were corrected in that PR as described in the 2026-10-18 notes.
- Service worker no longer caches API responses.
- `robots.txt`, `sitemap.xml`, Open Graph, `metadataBase`, and `favicon.ico` were added, and the
  pre-launch `noindex` was removed. Whether those are still what production serves was not re-checked.

---

## 3. Operator steps

### Recorded on 2026-10-18 as already done

Not re-checked on 2026-10-23. Treat as a note from that session, not as a new verification.

- Migration `037_production_schema_sync` was applied and, that day, the missing tables were
  reported present with RLS on and no anon/authenticated grants.
- The owner authorised `draft: false` on Terms, Privacy, and 2257. The code still has
  `draft: false` (`lib/help-content.ts`). That is not counsel sign-off.
- “Talk to a person” is a guided helper that routes urgent matters to Report content.

### 3.1 Shared project and migration 037

`supabase/migrations/20261018160000_037_production_schema_sync.sql` was written because
production had not received the tables from migrations 020, 023, 024, 025, 027, 030 and 035.
The 2026-10-18 session reported 037 applied. This update did not query Supabase, so it does
not confirm those tables today.

The migration skips 025’s `activity_log` because **the PIROKA Supabase project is shared with
another system** (tables `control_planes`, `tasks`, `kpis`, `vendors`, `incidents`,
`source_documents`… and an unrelated `activity_log`). Moving πroka to its own project is still
open (PRK-010).

### 3.2 Make the `photos` bucket private

PR #28 is merged. Whether the deploy that serves production includes it was not re-checked.
The bucket flip has not been confirmed. Owner SQL, after signed URLs are what production serves:

```sql
update storage.buckets set public = false where id = 'photos';
```

Flipping the bucket before that deploy would break every photo until the deploy lands.

### 3.3 Vercel production variables

This update did not list them. The 2026-10-18 note said the token in use then could not read env.

- `NEXT_PUBLIC_APP_URL=https://www.pirokaapp.com` — Didit callback and email links.
- `ADMIN_EMAILS` — without it nobody can open `/admin`.
- `EMAIL_UNSUBSCRIBE_SECRET` — any long random string.
- `OPS_WEBHOOK_URL` — still the only alert channel on `main`. Optional until you want alerts.
  Email via `OPS_ALERT_EMAIL` is open PR #50. Do not assume either channel is set.
- PayPal keys may stay set. They do **not** open checkout by themselves.
- `BILLING_ENABLED` — leave **unset**. Unset means new subscriptions are off in code.
  Setting exactly `true` turns checkout on. A redeploy picks up the value. Not verified here.
- Must be **absent**: `NEXT_PUBLIC_AUTH_DEMO`.

### 3.4 Legal sign-off

`/help/terms`, `/help/privacy`, and `/help/2257` do **not** show the draft banner. `draft` is
`false` in `lib/help-content.ts` because the owner authorised that on 2026-10-18. Counsel has
not signed off. The draft legal center is `docs/legal-review/`.

The 2257 custodian line is still `compliance@piroka.app`. A DNS lookup on 2026-10-23 returned
NXDOMAIN for `piroka.app`. The privacy page also uses `privacy@piroka.app`. See PRK-005 and
PRK-006.

### 3.5 Advisor SQL

Draft PR #46. Do not apply it from an app deploy. The owner or a superuser runs the preflight
and the forward transaction in that PR. See PRK-001.

---

## 4. Known gaps

- **Support** is a guided helper. A ticketing backend is still future work.
- **Appeals.** `/help/appeals` always shows Good standing (`components/help/account-standing.tsx`).
  There is no member route that inserts into `appeals`. `GET`/`PATCH /api/admin/appeals` can
  update a row and does not undo a suspension. The help copy’s 72 hour reply is not implemented.
  Detail: `docs/trust-safety/RUNBOOK.md`.
- **Location floor.** The 0–800 m disc is replaced on this branch by a 250–800 m annulus.
  Not deployed from the 2026-10-18 inspection, and not deployed by the 2026-10-23 doc update
  until this branch ships.
- Emoji still used as icons in live components. Non-token colors and radii remain, mostly on
  the homepage port.
- i18n is incomplete: `i18n.config.ts` lists `en`, `pt-BR`, and `es`; `app/layout.tsx` hardcodes
  `lang="en"`.
- Dead components, native `confirm()` dialogs, and an unread badge that is never fed were left
  as noted on 2026-10-18. Counts were not re-audited.
- The 11 e2e failures from 2026-10-18 were not re-run.
- Admin pages run service-role queries before the layout redirect resolves.

---

## 5. How the 2026-10-18 inspection was run

- Branch `claude/keen-albattani-7di58h` → PR #28, since merged.
- Audits that day: security, config/deploy, UX/links, plus live checks via Vercel and Supabase
  APIs and Playwright against localhost and production.

The 2026-10-23 edit changed this document, the location offset, the Trust & Safety runbook,
and `docs/registers/`. It did not repeat those live checks.
