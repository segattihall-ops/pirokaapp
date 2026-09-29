# πroka — build plan for Claude Code

Paste one phase at a time into Claude Code, run in the repo `segattihall-ops/pirokaapp`. Each phase ends with a working, deployable app. Read `../README.md` first. The HTML prototypes in `../design/` are the spec for layout, copy and behavior.

## Phase 0 — Scaffold (½ day)
> Create a Next.js 14 App Router app with TypeScript, Tailwind, ESLint, Prettier. Copy `starter/tailwind.config.ts`. Load Geist from Google Fonts in `app/layout.tsx`. Add `:focus-visible` green outline globally. Add Framer Motion, Three.js (`@react-three/fiber`, `@react-three/drei`), MapLibre GL, Zod, TanStack Query, Supabase JS. Set up `/`, `/onboarding`, `/app/(map|pulse|chats|places|me)`, `/account/(forgot|magic|reset)`, `/help/[slug]`. Deploy to Vercel.

## Phase 1 — Homepage + auth (2–3 days)
> Rebuild `design/Piroka Homepage.dc.html` in React: the Three.js globe (textured map tiles, atmosphere, rings, slow rotation and pulse; pause when the tab is hidden; reduce on `prefers-reduced-motion`), and the chat sign-up card with the exact copy. Wire Auth.js: Google, Apple, email magic link, anonymous (device-bound, upgradeable). Build `/account` from `design/Piroka Account.dc.html`. Every new account must go through: 18+ + terms checkboxes, then age estimation (Yoti or Persona web SDK, ID fallback). Store only `age_verified=true`. Block the app until it's verified.

## Phase 2 — Data + onboarding (2 days)
> Apply `starter/db/schema.sql` to Supabase. Add RLS: users read their own rows; public profile fields come through a view that excludes `true_geo`, email and prefs. Build `/onboarding` from `design/Piroka Onboarding.dc.html` (5 steps, 66 identities, pronouns, show-me, safety defaults, photos with EXIF stripping and a blurred variant, geolocation permission, visibility, disguise icon).

## Phase 3 — Map core (4–5 days)
> Build the app shell (80px rail on desktop, bottom bar on mobile) and MAP from `design/Piroka App v2.dc.html`: MapLibre with CARTO `dark_all` (Esri Dark Gray fallback), public positions from `starter/lib/geo/fuzz.ts` (server only), pins with conic intent rings (`starter/lib/intent.ts`), place pins, arrival pins, the fog circle for self, the time scrubber (Now → +6h), intent chips, the Filter sheet, and PIROKA Mode statuses that expire through pg_cron. Realtime updates over Supabase channels, throttled to 1 update per 5s per user. Nearby query returns at most 200 people, blocks excluded.

## Phase 4 — Profiles, chat, albums (4 days)
> Profile panel with progressive blur (`photoBlur`), trust badges, album grid (locked until granted), Request album, Report/Block. 1:1 chat with libsignal (X3DH + Double Ratchet), ciphertext-only storage, Smart Inbox buckets (`bucketFor`), unlock/lock my album, album-request card, "End-to-end encrypted" label. Album access enforced by signed URLs checked against `album_grants`.

## Phase 5 — Meet Mode + SafeMeet (2 days)
> Propose meet → accept → a 2h precise-sharing window (exact distance and the animated bridge line), a check-in timer (5/15/30/45) with push; a missed check-in sends a reminder, then SMS to the trusted contact via Twilio. Block & report ends the meet. Everything temporary reverts when `ends_at` passes.

## Phase 6 — Pulse, Places, Events, Groups, Trips (3–4 days)
> Pulse hotspots via PostGIS grid clustering (≥3 available people per ~450m cell, ↑ if 60% or more stay >45 min). Places with check-in and "I'm going" (TTL), events with RSVP, groups with membership, and moderated room chat. Trips with Photon city search; locals see "Arrives Fri" and can message before arrival.

## Phase 7 — Safety, privacy, moderation (3 days)
> Risk regions (country list in the prototype `FLAGGED`): force Area, blur photos, flag meets proposed within 10 minutes of first message. PIN lock (salted hash, lock on `visibilitychange`), Quick exit (Esc×2 + shield → decoy), disguised icons (PWA manifest variants + native alternate icons later). Reports queue + moderator console (internal), the warning → limited → suspended → removed ladder, and appeals routed to a different moderator. Help center and policies from `design/Piroka Help.dc.html`. Data export (JSON) and account deletion (soft delete now, hard delete in 30 days).

## Phase 8 — Plans + notifications (2 days)
> Stripe Checkout + Billing Portal for Plus ($5) and Premium ($10). Webhooks set `users.plan`. Enforce album limits and saved trips (Plus). Web push (VAPID) for match / album / arrival / status / safety, respecting `notif_prefs`. Notification center sheet.

## Phase 9 — AI (1–2 days)
> Smart search: `/api/smart-filter` calls Claude with the prompt in the prototype (`smart()` in App v2) and validates output with Zod against the allowed option lists. Support: draft replies for human agents (never auto-send safety cases). Moderation assist: spam/scam scoring, hate-speech flags, and PhotoDNA for CSAM (mandatory).

## Phase 10 — Admin console (3 days)
> Build `/admin` from `design/Piroka Admin.dc.html` behind role-based access (moderator, admin; SSO + hardware keys). Queues read from `reports`, `appeals`, a new `verifications` table and the helpdesk API. Every action writes to an append-only `audit_log`. Enforce "the appeal reviewer can't be the original moderator" in the database. Staff never see exact location, message plaintext or health data.

## Phase 11 — Sexual health + testing (2–3 days)
> Add a `health_cards` table (user_id, status, hiv_month, sti_month, prevention[], visibility, verified_month, verified_tests[]) encrypted with a per-user key (envelope encryption, KMS), plus `health_shares(owner, grantee)`. Upload flow: the image goes to a server route → Claude vision with the prompt from the prototype (`verifyDoc`) → store only the month and test types → delete the image → low-confidence results go to Admin → Verifications. Never offer HIV status as a filter. Put an explicit consent screen and a legal disclaimer before saving. Testing sites: a `testing_sites` table seeded with the 8 Dallas 75219 samples; admin verifies listings; later import from the CDC/GetTested API or state DSHS lists.

## Phase 12 — i18n, ethnicity, position marks (1–2 days)
> next-intl with en, pt-BR and es catalogs, browser-language default, and a switch in ME. Ethnicity as an optional self-described multi-select with a feature flag for the filter. Position glyphs as a small SVG sprite (see README → Position marks).

## Phase 13 — Assistant, taste learning, favorites (3 days)
> `/api/assistant`: a server-side Claude tool loop with `set_filters`, `find_people` (server query, public fields only) and `get_taste`. Rate-limited per user, and chats are not stored beyond the session unless the user opts in. `taste_events(user_id, target_id, kind, weight, at)` feeding a nightly per-user `taste_vector` (the same traits as the prototype, never ethnicity or health), plus user overrides `taste_flags`. The match score is computed server-side and gated by `plan = premium`. `favorites(user_id, fav_id)`, and an online-transition trigger that sends push to Premium users with alerts on (respect quiet hours and blocks).

## Phase 14 — Origins + flags (½ day)
> `users.origin` (ISO 3166-1 alpha-2 or `us-xx`), a select in Edit profile, and self-hosted SVG flags (lipis/flag-icons, MIT). Show the flag on the profile, arrival pins and the Pulse arrivals list.

## Phase 15 — Growth banners, ambassadors, events on the map (2–3 days)
> `promo_impressions(user_id, promo_id, shown_at, dismissed)` with server-side frequency caps (as in the prototype), remotely configurable campaigns, and no banners during the first session. `ambassadors(user_id, city, status, approved_by, powers text[])`, an ambassador queue view (content hidden with `pending_review`, never deleted), an agreement-rate metric, and admin approval with audit logging. Event pins from `events` where `starts_at` is today; the Pulse list sorted by start time and distance.

## Phase 16 — Launch polish (3–4 days)
> Offline queue for messages (IndexedDB) with retry. Stripe decline handling. The account-state middleware (limited / suspended) drives the banner and the blocking screen. A photo moderation status (`pending` / `approved` / `rejected` with a reason) on `photos`. Profile views and likes tables with Premium gating. Quiet hours and discreet push payloads (a generic title and body; the icon follows `disguise_icon`). Pre-meet video over WebRTC via LiveKit or Daily, with blur applied client-side (MediaPipe selfie segmentation) until both unblur, and no recording. Invite codes with an `referrals` table, rewards granted after the age check. A public `/e/[id]` event page (SSR, OG image, no attendee data). A `/partners` portal with separate auth and listing-owner verification.

## Definition of done
- Lighthouse ≥ 90 on mobile. All tap targets ≥ 44px. WCAG AA contrast. Full keyboard navigation.
- Raw coordinates never leave the server, verified by an automated test that inspects every API response.
- Statuses, check-ins, meets and location retention expire correctly (integration tests with a fake clock).
- Legal pages reviewed by counsel. 2257 custodian details filled in.
