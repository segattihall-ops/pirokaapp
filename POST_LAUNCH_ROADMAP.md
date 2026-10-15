# πroka — Post-launch infrastructure roadmap

21 features in three tiers. Everything runs with **no credentials** (console/demo
fallbacks, numbers read as zero) and switches on when the matching key appears in
`.env.local` / Vercel. See `KEYS.md` for where each key comes from.

Status legend: ✅ built · 🔌 needs a real key to leave demo mode

---

## Tier 1 — Foundations (6)

| # | Feature | Where | Status |
|---|---------|-------|--------|
| 1 | **Transactional email service** — provider-agnostic (`Resend` HTTP → SMTP → console), base template, every send logged to `email_log` | `lib/email/` | ✅ 🔌 `RESEND_API_KEY` or `EMAIL_SERVER` |
| 2 | **Email wired into flows** — welcome (onboarding), receipt + payment-failed + cancelled (PayPal webhook), subscribed/cancelled (billing routes), account deleted, password changed | `app/api/webhooks/paypal`, `app/api/billing/*`, `app/api/onboarding/save`, `app/api/me/account`, `app/api/me/security/password-changed` | ✅ |
| 3 | **Product analytics pipeline** — server `track()`, client `track()` + automatic pageviews, `analytics_events` table, optional PostHog forwarding | `lib/analytics/`, `app/api/analytics/track` | ✅ 🔌 `POSTHOG_KEY` optional |
| 4 | **Analytics wired into user actions** — signup/onboarding, status set, chat started, report filed, subscribe, cancel, account delete, page views | routes above + `components/providers.tsx` | ✅ |
| 5 | **Error tracking** — `captureError()`, `withApi()` route wrapper, React error boundaries, browser error reporter, `error_events` table, optional Sentry forwarding | `lib/errors/`, `app/error.tsx`, `app/global-error.tsx`, `app/api/errors/report` | ✅ 🔌 `SENTRY_DSN` optional |
| 6 | **System status + integrations panel** — `/api/status` JSON, public `/status` page, admin Integrations tab | `app/api/status`, `app/status`, `app/admin/integrations` | ✅ |

## Tier 2 — Operations (3 systems)

| # | Feature | Where | Status |
|---|---------|-------|--------|
| 7 | **Admin dashboard v2** — tabbed console, growth charts (signups / DAU 30d), funnel, top events, user search + user detail (plan override, mod ladder, email/analytics history) | `app/admin/*`, `components/admin/*`, `lib/admin/*` | ✅ |
| 8 | **Subscription analytics** — MRR / ARR, plan mix, new vs churned 30d, churn rate, revenue by month, failed payments, recent payments | `lib/billing/analytics.ts`, `app/admin/revenue` | ✅ |
| 9 | **Email campaigns** — compose (Markdown-lite), audience segments, test send, schedule, batched cron sender with per-user dedupe, unsubscribe link + marketing opt-out | `lib/campaigns/`, `app/admin/campaigns`, `app/api/cron/campaigns`, `app/unsubscribe` | ✅ |

## Tier 3 — Growth, retention, trust (12)

| # | Feature | Where | Status |
|---|---------|-------|--------|
| 10 | **Feature flags** — DB-backed, percentage rollout, env override, `useFlag()` hook, admin toggles | `lib/flags/`, `app/api/flags`, `app/admin/flags` | ✅ |
| 11 | **Announcements** — admin-authored banner with audience + schedule, dismissible per device | `components/growth/announcement-banner.tsx`, `app/admin/announcements` | ✅ |
| 12 | **In-app feedback** — "Send feedback" sheet on Me, admin inbox with triage status | `components/growth/feedback-button.tsx`, `app/admin/feedback` | ✅ |
| 13 | **Re-engagement emails** — day-7 and day-30 "we miss you" (once each, marketing opt-out respected) | `lib/lifecycle/`, `app/api/cron/lifecycle` | ✅ |
| 14 | **Win-back emails** — 3 days after a cancellation | `lib/lifecycle/` | ✅ |
| 15 | **Dunning sequence** — payment failed day 0 (webhook) → day 3 → day 7 reminders | `lib/lifecycle/` | ✅ |
| 16 | **Rate limiting** — Postgres-backed fixed window (`rate_limit_hit()`), in-memory fallback, applied to public write endpoints | `lib/api/rate-limit.ts` | ✅ |
| 17 | **Audit log viewer** — filter by action / actor / target | `app/admin/audit` | ✅ |
| 18 | **Data export** — "Download my data" JSON (profile, photos, statuses, trips, favourites, payments, notifications, events) | `app/api/me/export`, Me screen | ✅ |
| 19 | **Weekly admin digest** — stats + revenue + errors emailed to `ADMIN_EMAILS` | `app/api/cron/digest` | ✅ |
| 20 | **Public status page** — `/status` reads `/api/status` (no secrets) | `app/status` | ✅ |
| 21 | **Outbound ops alerts** — Slack/Discord-compatible webhook on payment failures, new reports, error spikes, new feedback | `lib/alerts/` | ✅ 🔌 `OPS_WEBHOOK_URL` |

---

## Cron schedule (`vercel.json`)

| Path | Schedule | Purpose |
|------|----------|---------|
| `/api/cron/safemeet` | every 5 min | SafeMeet reminders (existing) |
| `/api/cron/campaigns` | every 10 min | Send scheduled campaigns in batches of 100 |
| `/api/cron/lifecycle` | daily 14:00 UTC | Re-engagement, win-back, dunning |
| `/api/cron/digest` | Monday 13:00 UTC | Weekly admin digest |

All cron routes require `Authorization: Bearer $CRON_SECRET`.

## Database

One migration: `lib/db/migrations/032_post_launch_systems.sql` (idempotent). Tables:
`analytics_events`, `error_events`, `email_log`, `email_campaigns`, `feature_flags`,
`announcements`, `feedback`, `rate_limits` (+ `rate_limit_hit()`), and two columns on
`users` (`marketing_opt_out`, `payment_failed_at`). All new tables are service-role only.

## New environment variables

```
RESEND_API_KEY=            # preferred email provider; falls back to EMAIL_SERVER (SMTP), then console
EMAIL_UNSUBSCRIBE_SECRET=  # signs unsubscribe links (falls back to NEXTAUTH_SECRET)
POSTHOG_KEY=               # optional: mirror analytics events to PostHog
POSTHOG_HOST=https://us.i.posthog.com
SENTRY_DSN=                # optional: mirror captured errors to Sentry
OPS_WEBHOOK_URL=           # optional: Slack/Discord incoming webhook for ops alerts
NEXT_PUBLIC_APP_URL=       # absolute URL used inside emails (falls back to NEXTAUTH_URL)
```
