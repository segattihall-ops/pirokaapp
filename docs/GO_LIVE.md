# πroka — Go-live inspection (2026-10-18)

Full pre-launch pass over the app that is already serving **https://www.pirokaapp.com**
(Vercel project `pirokaapp`, Supabase project `PIROKA`). Everything below was verified by
reading the code, running the checks, or querying production directly — not assumed.

## Verdict

**Code: ready once PR #28 is merged.** Production build, typecheck and lint are clean; the
blocking defects found by the inspection are fixed in that PR.

**Operations: 4 steps remain that only you can approve/do** (section 3). Two are one-line
production changes I can run the moment you say go; two are keys/legal.

## Billing at launch

PIROKA does not charge at launch. New Plus/Premium checkouts stay **off** unless
`BILLING_ENABLED` is exactly `true`. Leave that variable **unset** in Vercel. PayPal keys can stay
in place.

With it unset:

- `/api/status` reports billing **off**, detail `billing disabled by BILLING_ENABLED`.
- `POST /api/billing/checkout`, `/api/billing/subscribe`, and `/api/billing/change` return **503**
  and do not call PayPal.
- `GET /api/billing/status` reports `configured: false` and `billingEnabled: false`, so Me → Plan &
  billing shows “Billing not available yet” with no PayPal buttons and no upgrade CTA. The browser
  does not decide this from `NEXT_PUBLIC_PAYPAL_*` (those are fixed at build time).
- Webhooks, cancellation (including pause and resume), and receipts keep working for anyone who
  already has a subscription.

Set `BILLING_ENABLED=true` only when the owner decides to charge. With the flag on, checkout
behaves as it did when PayPal keys alone opened it. `OPEN_ENDED` launch access in
`lib/billing/launch.ts` is a separate switch and stays on.

---

## 1. What was checked

| Area | Result |
|---|---|
| `next build` / `tsc --noEmit` / `next lint` | ✔ clean on every commit |
| Playwright e2e (local, demo mode) | 80 passed · 11 failed — all 11 are stale tests or environment-only (expect `400` where routes now answer `401` first, need a local DB or `E2E_AUTH_TOKEN`, or test the SW in dev mode). No product bug behind any of them. |
| Production smoke (`e2e/smoke.full.spec.ts` against www) | Homepage ✔; sign-in is blocked for the headless browser by **Cloudflare Turnstile** (correct — bot protection works). Post-gate flows verified locally instead. |
| Production probes | `/`, `/help/*`, `/e/*`, `/manifest.webmanifest` 200 · `/app`, `/admin` → gate redirect ✔ · HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy present ✔ · apex → www 308 ✔ |
| `/api/status` (production, 2026-10-18) | database ok · email ok (Resend) · push ok · age ok (Didit) · cron ok · **billing OFF (PayPal keys were missing that day)** · **ops alerts OFF (OPS_WEBHOOK_URL missing)** |

The 2026-10-18 reading is historical. PayPal keys may be present now. Checkout stays hidden because
`BILLING_ENABLED` is unset, not because the keys are missing. See **Billing at launch** above.
| Supabase security advisors | No critical πroka finding. 25 tables “RLS on, no policies” = intended (server uses the service role; anon is denied). `spatial_ref_sys` is PostGIS’s own table. |
| Security audit (all ~130 API routes, middleware, webhooks, crons) | 3 critical, 5 high → fixed (section 2) |
| Config / env / schema audit | Production DB was missing the tables of 7 migrations → sync migration written (section 3.1) |
| UX / link audit | 3 blockers, 8 high → fixed or hidden (section 2) |

---

## 2. Fixed in PR #28

### Security
- **Private photos were world-readable.** The `photos` bucket is public and keys are predictable
  (`users/<uuid>/photos/<slot>.original.jpg`); any member could turn a blurred map thumbnail into
  the clear photo and the whole private album. Every photo link is now a **1-hour signed URL**
  minted by the route that already decides clear-vs-blur. → requires step 3.2 (make the bucket private).
- **18+ gate enforced on the API, not only on pages.** A signed-in but unverified account could
  call `/api/nearby`, chat, upload photos, etc. directly. `middleware.ts` now answers 403 on every
  `/api/*` route except the gate itself, auth, telemetry, public intake, account hygiene,
  webhooks and crons.
- Open redirect in `/auth/callback` (`?next=/\evil.com`) closed.
- PayPal: `custom_id` (set by the browser) could re-point another member’s subscription or let one
  payment unlock many accounts. Webhook and `/api/billing/subscribe` now bind one subscription to
  one member.
- Rate limits on `/api/chat/start` and `/api/keys/bundle` (one-time pre-key draining).
- XP amounts and referral rewards are decided server-side.
- Hard-coded fallback secrets removed from demo auth and unsubscribe tokens (production falls back
  to the service-role key, never to a literal).
- Area board stores a ~1 km grid cell instead of exact coordinates; radius bug (km vs m) fixed.
- Dead `next-auth` stack removed (`lib/auth/config.ts` with `allowDangerousEmailAccountLinking`).

### Product
- Public **Report content** form was dead in production (503). Reports now persist to the T&S
  `reports` queue; the ops webhook is pinged when configured.
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
  `favicon.ico` added (every tab open was hitting the 404 page).
- FAQ copy no longer promises a PIN lock that does not exist.

---

## 3. Operator steps (yours)

### ✅ Already done for you (this session)
- **Migration 037 applied to the production Supabase database** and verified: the 13 missing tables
  exist, RLS is on, anon/authenticated have no grants; `travel_mode` keeps its owner-only policy so
  PIROKA Mode still works; the `couchless` intent value and `statuses.travel_mi` column were added.
- **Legal pages approved** (you authorised it): Terms, Privacy and 2257 no longer show the draft
  banner (`draft: false`).
- **Support surface made honest**: “Talk to a person” is now a guided helper that answers from the
  help articles and routes anything urgent to **Report content** (which delivers to the T&S queue);
  the false “replies in 5 min / 24 h SLA” presence copy is gone.

### 3.1 (reference) migration `037_production_schema_sync`
Production never received the tables from migrations 020, 023, 024, 025, 027, 030 and 035.
Today these routes 500 in production: Desperate mode (`/api/me/desperate`), Pulse heatmap,
Travel (`saved_trips`, `travel_mode`), Area board (`/app/chats/area`), message threads,
XP / referrals / leaderboard, saved filters, taste/match.

`supabase/migrations/20261018160000_037_production_schema_sync.sql` is idempotent, creates only
what is missing, and locks every table to the service role. It deliberately skips 025’s
`activity_log` because **the PIROKA Supabase project is shared with another system** (tables
`control_planes`, `tasks`, `kpis`, `vendors`, `incidents`, `source_documents`… and an unrelated
`activity_log`). Recommended after launch: move πroka to its own project.

### 3.2 Make the `photos` bucket private — **I can run it, but only after PR #28 is deployed**
```sql
update storage.buckets set public = false where id = 'photos';
```
Signed URLs work on a public bucket too, so the order is: merge → deploy → flip. Flipping first
would break every photo for the minutes until the deploy lands.

### 3.3 Vercel → Production environment variables (I could not list them: the Vercel token has no env read permission)
Confirm present / set:
- `NEXT_PUBLIC_APP_URL=https://www.pirokaapp.com` — used in Didit callback and every email link.
  (The PR adds a fallback to Vercel’s production domain, but set it explicitly.)
- `ADMIN_EMAILS` — without it nobody can open `/admin`.
- `EMAIL_UNSUBSCRIBE_SECRET` — any long random string.
- `OPS_WEBHOOK_URL` — Slack/Discord webhook; reports, payments and errors alert there. Optional but strongly recommended on launch day.
- PayPal keys may stay set: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`,
  `PAYPAL_ENV=live`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, `NEXT_PUBLIC_PAYPAL_PLAN_PLUS_ID`,
  `NEXT_PUBLIC_PAYPAL_PLAN_PREMIUM_ID`. They do **not** open checkout by themselves.
- `BILLING_ENABLED` — leave **unset** (do not set it to `true`). Unset means new subscriptions are
  off. Webhooks, cancellation, and receipts still run off the PayPal keys above. Setting exactly
  `true` turns checkout back on with no other code change. A redeploy picks up the value.
- Must be **absent**: `NEXT_PUBLIC_AUTH_DEMO`.

### 3.4 Legal sign-off
`/help/terms`, `/help/privacy` and `/help/2257` show the banner *“Draft text for design review.
Have it reviewed by counsel before launch.”* and are the pages the sign-up consent links to.
When counsel approves, set `draft: false` for the three entries in `lib/help.ts` and
`lib/help-content.ts`. The 2257 page still needs the custodian-of-records details.

---

## 4. Known gaps left as-is today (honest list)
- **Support** is now a guided helper (answers from help articles) that routes urgent matters to the
  Report channel, which does deliver. A full ticketing/live-chat backend is still future work.
  Account standing / appeals screens are still static (show the real default; no appeals backend yet).
- Emoji still used as icons in ~25 live components (venue glyphs, 🔒, ✈️…) — rule says inline SVG.
- ~90 non-token `rgba()` / 87 arbitrary radii remain, mostly in the homepage port.
- i18n is half-installed (English only; `lang="en"` hard-coded).
- 24 never-imported components (dead code) remain in `components/`.
- Native `confirm()` dialogs in 13 places.
- Unread badge on the tab bar is never fed.
- 11 stale e2e tests (see table above).
- Admin pages run their service-role queries before the layout’s admin redirect resolves
  (response is still a redirect; move the check into middleware later).

---

## 5. How this was run
- Branch `claude/keen-albattani-7di58h` → PR #28 (draft).
- Audits: three parallel read-only passes (security, config/deploy, UX/links) + live checks via
  Vercel and Supabase APIs + Playwright against localhost and production.
