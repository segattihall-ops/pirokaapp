# πroka — Go-live inspection

Full pre-launch pass over the app that is already serving **https://www.pirokaapp.com**
(Vercel project `pirokaapp`, Supabase project `PIROKA`). Sections 1 and 2 are the
**2026-10-18** inspection record. They were not re-run as a full inspection on 2026-10-23.

**2026-10-23 update.** Current gate status is `docs/registers/LAUNCH_GATES.md`.
PR #49 (billing gate) and PR #50 (email ops alerts) are merged. This document update did not
change Vercel, Supabase, or PayPal. Two production readings from that day are recorded below:
billing is live in the off position, and the alerts code is deployed without `OPS_ALERT_EMAIL`
visible as of 18:40 UTC.

## Verdict

The code fixes from the 2026-10-18 inspection are on `main` (PR #28, merged). That is not a
launch approval. Open gates, including the advisor SQL, the photos bucket, counsel, DNS, and
age verification, are listed in `docs/registers/LAUNCH_GATES.md`. The billing gate is live and
off. Ops-alert code from #50 is deployed; the inbox variable was not visible in production as
of 18:40 UTC.

## Billing at launch

The owner decision on 2026-10-23 is that PIROKA does not charge at launch. In code, new
Plus/Premium checkouts stay **off** unless `BILLING_ENABLED` is exactly the string `true`
(merged PR #49). Leave that variable **unset** in Vercel until you decide to charge. PayPal
keys may stay in place.

On 2026-10-23, production `/api/status` reported billing off with detail
`billing disabled by BILLING_ENABLED`. That is the live gate.

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

## Ops alerts

PR #50 is merged (`0db1d63`). `OPS_ALERT_EMAIL` sends through the existing Resend sender.
`OPS_WEBHOOK_URL` stays optional. Either channel is enough. Bodies are a one-line pointer
(type, id, admin link, count, timestamp). Coordinates, chat, identity documents, and the report
narrative are not included. The same alert is not sent again for five minutes on that server
instance.

The alerts code is deployed. As of 2026-10-23 18:40 UTC, `OPS_ALERT_EMAIL` was not visible in
production, so the email channel is not confirmed there. Set the variable and redeploy, then
confirm `/api/status` reports Ops alerts **ok** with detail `email`, `webhook`, or
`email + webhook`.

---

## 1. What was checked (2026-10-18)

These rows are the inspection record. They are not a fresh result.

| Area | Result on 2026-10-18 |
|---|---|
| `next build` / `tsc --noEmit` / `next lint` | Clean on the commits inspected that day. |
| Playwright e2e (local, demo mode) | 80 passed · 11 failed — the note that day attributed all 11 to stale tests or environment (expect `400` where routes now answer `401` first, need a local DB or `E2E_AUTH_TOKEN`, or test the SW in dev mode). Not re-run on 2026-10-23. |
| Production smoke (`e2e/smoke.full.spec.ts` against www) | Homepage ok. Sign-in was blocked for the headless browser by Cloudflare Turnstile. |
| Production probes | `/`, `/help/*`, `/e/*`, `/manifest.webmanifest` 200 · `/app`, `/admin` redirected at the gate · HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy present · apex → www 308. |
| `/api/status` | database ok · email ok (Resend) · push ok · age ok (Didit) · cron ok · billing off · ops alerts off (neither `OPS_ALERT_EMAIL` nor `OPS_WEBHOOK_URL` was set). The billing cause written that day was missing PayPal keys. That cause is withdrawn. |
| Security audit (all ~130 API routes, middleware, webhooks, crons) | 3 critical, 5 high → fixed (section 2). |
| Config / env / schema audit | Production DB was missing the tables of 7 migrations → sync migration written (section 3.1). |
| UX / link audit | 3 blockers, 8 high → fixed or hidden (section 2). |
| Supabase security advisors | The 2026-10-18 note said there was no critical πroka finding, that 25 tables had RLS on and no policies, and that `spatial_ref_sys` was only PostGIS’s own table. **Do not use that sentence.** Draft PR #46 (catalog snapshot 2026-10-21, project `clwqmzgoqfqibnfevhyb`) records `public.spatial_ref_sys` with RLS disabled and with `anon` / `authenticated` holding every table privilege, not only `SELECT`. Supabase’s name for a public table without RLS is `rls_disabled_in_public`. The SQL in that PR has not been applied. This update did not re-query the advisor. |

Later production readings, 2026-10-23, and only these two:

- Billing: `/api/status` detail `billing disabled by BILLING_ENABLED`.
- Alerts: the #50 code is deployed. `OPS_ALERT_EMAIL` was not visible in production as of 18:40 UTC.

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
  one member. New checkout is additionally behind `BILLING_ENABLED` (PR #49, merged).
- Rate limits on `/api/chat/start` and `/api/keys/bundle`.
- XP amounts and referral rewards are decided server-side.
- Hard-coded fallback secrets removed from demo auth and unsubscribe tokens.
- Area board stores a ~1 km grid cell instead of exact coordinates; radius bug (km vs m) fixed.
- Dead `next-auth` stack removed.

### Product
- Public **Report content** form persists to the Trust & Safety `reports` queue. The ops channel
  (email and/or webhook, PR #50, merged) is pinged with a pointer when configured. The report
  narrative stays in the queue and is not copied into the alert.
- 5 “Upgrade / Plan & billing” buttons dead-ended on the magic-link page → `/app/me#billing`.
  3 help links 404’d (`/help/trust`, `/help/safemeet`) → Safety Center. Paywall “Back” → map.
- Quick-exit shield was a dead button → leaves for a neutral page with no history entry.
- Pulse “Trends” tab showed `Math.random()` analytics to paying members → hidden until the
  `activity_trends` backend exists.
- Checkout feature list now matches the shipped gates; `PLAN_PRICES` aligned to $5 / $10.
- Admin console: invented T&S cases (`ts-seed`) never render in production.
- `?demo=1` fake people on the map: development only. Prototype sample events `/e/e0–e2`:
  development only.
- EventCard rebuilt on design tokens with visible RSVP errors and list refresh.
- Service worker no longer caches API responses (other members’ data on shared devices) or
  stale HTML; dead precache entries and missing badge icon fixed.
- `robots.txt`, `sitemap.xml`, Open Graph, `metadataBase`; pre-launch `noindex` removed.
  `favicon.ico` added (every tab open was hitting the 404 page). Whether those are still what
  production serves was not re-checked on 2026-10-23.
- FAQ copy no longer promises a PIN lock that does not exist.

---

## 3. Operator steps

### Recorded on 2026-10-18 as already done

Not re-checked on 2026-10-23, except the two `/api/status` readings named above. Treat the rest
as a note from that session.

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

This update did not list the Vercel project. The 2026-10-18 note said the token in use then
could not read env. The two `/api/status` readings above are the production facts recorded since.

- `NEXT_PUBLIC_APP_URL=https://www.pirokaapp.com` — Didit callback and email links.
- `ADMIN_EMAILS` — without it nobody can open `/admin`.
- `EMAIL_UNSUBSCRIBE_SECRET` — any long random string.
- `OPS_ALERT_EMAIL` — one inbox, or several separated by commas. This is the channel to set.
  Alerts go out through the Resend setup already in production (`RESEND_API_KEY` and `EMAIL_FROM`
  stay as they are). Subject looks like `[PIROKA alert] report`. As of 2026-10-23 18:40 UTC this
  variable was not visible in production. Set it and redeploy.
- `OPS_WEBHOOK_URL` — optional Slack/Discord webhook of the same one-line alert. Email alone is
  enough: `/api/status` reports Ops alerts **ok** with detail `email`, `webhook`, or
  `email + webhook`. It stays **off** only when both are unset.
- PayPal keys may stay set: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`,
  `PAYPAL_ENV=live`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, `NEXT_PUBLIC_PAYPAL_PLAN_PLUS_ID`,
  `NEXT_PUBLIC_PAYPAL_PLAN_PREMIUM_ID`. They do **not** open checkout by themselves.
- `BILLING_ENABLED` — leave **unset** (do not set it to `true`). Production already reports
  `billing disabled by BILLING_ENABLED`. Setting exactly `true` turns checkout back on with no
  other code change. A redeploy picks up the value.
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
  Not deployed from the 2026-10-18 inspection, and not deployed by this document update.
- **Ops inbox.** Alert code from #50 is deployed. `OPS_ALERT_EMAIL` was not visible in production
  as of 2026-10-23 18:40 UTC.
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

The 2026-10-23 edit merged `main` (including #49 and #50) into the location-privacy branch and
recorded the two production readings above. It did not repeat the rest of those live checks.
