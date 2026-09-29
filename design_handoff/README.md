# Handoff: πroka — full product (web app)

## Overview
πroka ("Know who's ready.") is an intent-first, map-based social app for queer adults. This package covers the full product flow:

1. **Homepage**: animated 3D globe, sign-up and login through a chat, 18+ and terms consent, face age check.
2. **Onboarding**: 5-step profile setup.
3. **App**: MAP · PULSE · CHATS · PLACES · ME, plus sheets, overlays and safety tools.
4. **Help & Legal**: help center, human support, account standing and appeals, report form, policies.

Target repo: `segattihall-ops/pirokaapp` (branch `main`). It currently holds only a README.

## About the design files
The `.dc.html` files in `design/` are **design references built in HTML**. They are working prototypes that show the intended look and behavior, not production code to copy. Recreate them in the target stack. The original brief asked for **Next.js 14 (App Router) + TypeScript + Tailwind CSS + Three.js + Framer Motion**, which is the recommended choice.

To open a prototype, keep `support.js` next to the files and open any `.dc.html` directly in a browser. Markup is in `<x-dc>`. Logic is the `class Component` in the `<script data-dc-script>` tag at the bottom of each file: state, handlers and derived values in `renderVals()`. Treat that class as the behavioral spec.

**Everything below is simulated in the prototype and must be built for real:** other users, their replies and accepted meets, verification, support replies, payments, moderation review, face age estimation, notifications and E2E encryption. See "Backend & integrations".

## Fidelity
**High-fidelity.** Colors, type, spacing, radii, copy and interactions are final. Recreate them pixel-accurately.

---

## Design tokens

**Colors**
| Token | Hex | Use |
|---|---|---|
| ink-950 | `#070707` | App background |
| ink-900 | `#0a0a0a` | Panels, chat list |
| ink-850 | `#0e0e0e` | Inputs, floating controls (`rgba(14,14,14,0.9)` over map) |
| ink-800 | `#111111` | Rail bottom stop |
| ink-750 | `#1a1a1a` | Rail top stop, avatar fill |
| white | `#ffffff` | Primary light buttons (Send, "Start face check") |
| text | `#f5f5f5` | Primary text |
| text-2 | `#cccccc` | Body on dark cards |
| text-3 | `#999999` | Secondary text |
| text-4 | `#666666` | Tertiary, placeholders |
| green | `#34d399` | Brand accent, CTAs, live/now intent, selection |
| green-hover | `#6ee7b7` | Link hover |
| danger | `#f87171` | Report, delete, errors |
| warning | `#fbbf24` | Higher-risk region banner, safety notifications |

Hairlines: `rgba(255,255,255,0.06–0.14)`. Selected chip or option: border `rgba(52,211,153,0.75)` + fill `rgba(52,211,153,0.14)`. Glass cards: `linear-gradient(155deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02) 50%)` over `rgba(12,12,12,0.9)`, `backdrop-filter: blur(16–26px)`.

**Intent colors** (pins, chips, rings): green `#34d399` = Available now / Next hour / Hosting / Can travel. White `#f5f5f5` = Tonight / Later / Visiting. Grey `#666` = Just looking (pin at 55% opacity).

**Typography**: **Geist** (Google Fonts) 400/500/600/700 everywhere.
- Display: 26–32px / 600 / −0.03em.
- Section title: 15px / 600.
- Body: 13–15px / 400–500 / 1.45–1.65.
- Labels: 11–12px.
- Eyebrow: 11px / 700 / +0.14em uppercase, green.
- Nav labels: 9px / 600 / +0.08em.

**Radius**: chips and pills 999px · buttons 10–16px · inputs 11–14px · cards 14–20px · sheets 26px (top corners) · large cards 28px · logo tile 15px.

**Spacing**: 4 · 6 · 8 · 10 · 12 · 14 · 16 · 18 · 22 · 28px. Map overlay inset is 14px.

**Shadows**: floating `0 18px 50px rgba(0,0,0,0.5)` · side panels `-30px 0 80px rgba(0,0,0,0.55)` · sheets `0 -30px 80px rgba(0,0,0,0.6)` · pins `0 6px 16px rgba(0,0,0,0.55)`.

**Motion**:
- `piIn`: opacity 0→1, translateY 10px→0, 0.3–0.5s ease-out. Used for cards, messages and sheets.
- `slideR`: translateX 24px→0, 0.3–0.35s. Used for side panels.
- `pinIn`: scale 0.5→1, 0.35s.
- `piPulse`: 0→16px green ring, 2–2.4s infinite. Used for your dot and live status.
- `piBreathe`: scale 0.85↔1.08, 3.2s. Used for Pulse hotspots.
- `piDash`: stroke-dashoffset loop, 1s. Used for the Meet Mode bridge line.
- Typing dots: 1.2s staggered 0.15s.

Keep motion confident, with no bounce.

**Logo**: a square tile (gradient `#262626`→`#070707`, 1px `rgba(255,255,255,0.16)` border) with a white "π" and a 7px green dot top-right with `0 0 8px #34d399` glow. Wordmark "πroka". Source artwork: `uploads/Imagem do Codex 20 de set. de 2026, 14_13_18.png` in the design project.

---

## Screens

### 1. Homepage — `Piroka Homepage.dc.html`
- **Background**: a full-bleed Three.js globe with map tiles textured onto it, a green atmosphere and halo, rotating rings, slow rotation and pulse. The globe must never compete with the chat card.
- **Header**: logo + "πroka" + tagline **"Know who's ready."**
- **Chat card**, glass with 28px radius:
  - Header "πroka" with an "Online" green dot, then bot messages.
  - Sign-up options: Continue with Google (white), Continue with Apple (black), Use Email Instead (subtle), Continue Anonymously (subtle).
  - A message input with a white Send button, plus a "Start chatting" CTA.
  - A separate **Log in** view: email and password, "Forgot?".
- **Required gate for every sign-up path (Google, Apple, email, anonymous):**
  1. Two checkboxes, "I'm 18 or older" and "I accept the Terms…, Privacy… and Community Guidelines". Continue is disabled until both are checked.
  2. **Face age check**: front camera inside a 176px circle, a green conic progress ring, a scanning line, then "Verified 18+". If the camera is unavailable, fall back to "Verify with a photo ID instead".
  3. "Enter πroka →" goes to Onboarding.
- **Footer**: Terms · Privacy · Community Guidelines · Safety · Report Content · 18 U.S.C. § 2257, each linking to Help & Legal (`#terms`, `#privacy`, …), plus map attribution.
- **Responsive**: globe and chat side by side on desktop, stacked on tablet, and on mobile a smaller globe with the chat as the focus.

### 2. Onboarding — `Piroka Onboarding.dc.html`
- Layout: 560px max column, a 5-segment progress bar (green up to the current step), a glass card, and Back / Continue (Continue disabled until the step is valid).
- **Step 1, how you show up**: Display name or Anonymous. Name is required (at least 2 characters) when named. Pronoun chips (he/him, she/her, they/them, he/they, she/they, any pronouns, ask me) plus a custom field. Shows "✓ Age verified 18+".
- **Step 2, who you are**: searchable chips across 66 identities (20 gender, 16 orientation, 30 communities). Pick any number, including none.
- **Step 3, who you want to see**: Men, Women, Trans women, Trans men, Non-binary people, Everyone (Everyone is exclusive). At least one is required. Safety toggles: Blur photos until mutual (on), Only verified humans can message me (off), Filter explicit first messages (on).
- **Step 4, photos**: 3 slots (main, then 2 album) in a 1.3fr/1fr/1fr grid at 3:4, plus "Stay faceless for now".
- **Step 5, location & privacy**: geolocation permission. Visibility: Neighborhood (~0.3 mi fuzz), Area (~1 mi), or Hidden. App icon: πroka, Calculator, Weather or Notes.
- **Finish**: persist the profile, then go to the app.

### 3. App — `Piroka App v2.dc.html`
- **Shell**:
  - Desktop (820px and up): an 80px left rail with the logo, then MAP · PULSE · CHATS · PLACES · ME (active item has a green 3px left bar and a tinted tile), the Chats unread badge, and at the bottom a Quick-exit shield plus a SafeMeet button while a meet is active.
  - Mobile: a 66px bottom tab bar with the same five items.
- **MAP**:
  - Dark map, with drag to pan and wheel or buttons to zoom (levels 11–18).
  - A vignette overlay.
  - Your position shows as a green dot inside a dashed "fog" circle sized by your visibility setting. There is no dot at all in Hidden.
  - **Person pins (46px)**: a conic ring in the intent color whose filled arc shows time remaining, around a photo that is blurred by trust level:
    - 11px blur: stranger.
    - 5px: you've chatted.
    - 0: mutual or in Meet Mode.
    - Badge: house = Hosting, arrow = Can travel, plane = Visiting.
  - **Place pins**: 36px rounded squares with a letter and an active-count badge.
  - **Arrival pins**: dashed circle with a plane icon.
- **Top overlay**:
  - "Set your intent" / current status with time left.
  - "Near {city} · N ready".
  - Bell (unread count), Places toggle, Travel, Filter (active count).
  - Intent chips with counts: Everyone / Now / Tonight / Hosting / Visitors.
  - **Meet Mode bar**: name · type · ETA · check-in countdown · ends in · SafeMeet / End.
  - **Higher-risk region banner**: amber border.
  - **Preview banner** when viewing another city.
- **Time scrubber** (bottom): Now → +6h in 15-minute steps. The map shows who will be available at the chosen time, with "Back to now".
- **PULSE**: a 380px right panel with stats (Available now, Hosting, Tonight, Visitors), hotspots (direction · distance · N now ↑/↓, tap to fly there), "Arriving soon" with "Say hi →" (opens a chat before they land) and trending places. Hotspots also "breathe" on the map.
- **PLACES** panel, with tabs:
  - **Places**: sorted by active count. Detail shows type · distance · event, Here now / On the way / Visitors, "Check in" and "I'm going", people nearby, and a live **place chat**.
  - **Events**: date tile, name, place · going, RSVP toggle.
  - **Groups**: 8 communities. Detail shows join/leave, moderator, next event, and a group chat (posting requires joining).
- **CHATS**:
  - List: buckets NOW · MUTUAL · ACTIVE · LATER · EXPIRED. Each row shows an intent-ring avatar, a live context line (e.g. "Hosting · 42m more · ~0.3 mi" or "Asked to see your album") and an unread count.
  - Thread header: name, context, "End-to-end encrypted", then Request album · Unlock my album / Album shared ✓ · Report · Profile · Propose meet (mutual only).
  - Thread body: messages, system pills, unlocked-album message cards, and an "asked to see your album" card with Unlock / Not now.
- **Profile panel** (420px right):
  - A 360px photo with progressive blur and a note ("Blurred — unlocks when mutual").
  - Intent card with time left, name, stats (pronouns · age · height · position · orientation), distance ("~0.4 mi · neighborhood precision", or exact in Meet Mode).
  - Trust badges, bio, Report / Block, tags.
  - **Album**: a 5-column grid, locked and blurred until they unlock it, with "Request album".
  - Actions: Chat · Interested · Next →.
- **ME**:
  - Profile header.
  - **PIROKA Mode**: timed status and visibility (Neighborhood / Area / Hidden).
  - **Trust signals**: human, photo, phone.
  - **SafeMeet**: trusted contact and check-in timer (5 / 15 / 30 / 45 min).
  - **Trips**.
  - **Your album**: 5 slots, where slots above the plan limit are locked with "Plus". Plans: Anonymous / Free = 2 photos, Plus $5 / Premium $10 = 5 photos.
  - **Privacy & safety**: disguised icon, PIN lock, Quick exit, notification preferences, blocked list, Download my data, Account standing, Talk to a person, Edit profile, Delete account (with confirmation).
- **Sheets** (bottom, max 480px, 26px top radius):
  - **PIROKA Mode**: 8 intents × 30m / 1h / 2h / 4h; the status expires on its own.
  - **Filter**: a natural-language line (e.g. "vers, hosting, under 35"), age range, and groups Show me / Position / Body / Identity / Orientation / Looking for.
  - **Plan a trip**: live city search, popular cities, arrival day, "Look now" and "Save trip" (Plus).
  - **Propose a meet**: Public spot / My place / Their place, 10 / 20 / 30 min, boundaries.
  - **SafeMeet check-in**: I'm OK / Share plan / Block & report.
  - **Report**: 8 reasons, details, "Attach recent messages", then "Report and block".
  - **Plans**: comparison → card → success.
  - **Notifications**.
- **Overlays**:
  - **PIN lock**: 3×3 keypad plus 0 and ⌫, 4 dots. It locks on launch and whenever the app is hidden.
  - **Decoy**: a fake weather screen, triggered by Esc twice or the shield. Tapping "72°" three times returns (to the PIN screen if a PIN is set).
- **Meet Mode**: after the other person accepts, draw an animated green dashed line between you with an "ETA" pill. Share exact location for 2 hours, then revert automatically. SafeMeet check-in prompts on the timer.

### 4. Help & Legal — `Piroka Help.dc.html`
- Layout: header, a sticky left nav (Help / Policies groups), and the content area. Hash routes: `#help`, `#support`, `#appeals`, `#report`, `#guidelines`, `#safety`, `#terms`, `#privacy`, `#2257`.
- **Help center**: searchable FAQ accordion (8 items).
- **Talk to a person**: support chat with "Ana", a PT/EN toggle, quick topics and an SLA line.
- **Account standing**: status, the 4-step moderation ladder (Warning → Limited → Suspended → Removed), and a case card with Why / Rule / appeal textarea, which becomes "appeal pending" after submitting.
- **Report content**: works without an account. 8 types, link, description, optional email, returns a report ID.
- **Policy pages**: Guidelines, Safety, Terms, Privacy and 2257. Terms, Privacy and 2257 are marked **draft — counsel must review before launch**.

---

## State & data model (suggested)
- **User**:
  - `id, handle|null (anonymous), pronouns[], gender, orientation[], communities[], showMe[], age (verified flag only), photos: {main, album[]}, plan: 'anonymous'|'free'|'plus'|'premium', visibility: 'neighborhood'|'area'|'hidden', trust: {human, photo, phone}, safetyPrefs, notifPrefs, pinHash, disguiseIcon`.
- **Session / status**:
  - `{ userId, intent: now|next|hosting|travel|tonight|later|visiting|looking, startsAt, endsAt }`. Server-side TTL; expired statuses are removed automatically.
- **Location**:
  - Store the true position at reduced precision, deleted after 24h.
  - Serve a **fuzzed** position (random offset inside a 0.3 or 1 mi disc, re-rolled per session) and **rounded distances** (0.1 mi) to others.
  - Never serve raw coordinates. Also guard against trilateration: fixed per-session noise and rate-limited distance queries.
- **Meet**: `{ a, b, type, eta, boundaries, startedAt, endsAt(+2h), checkinEvery }`. Precise location is shared only while it's active and both have consented.
- **Chat**: E2E encrypted (Signal protocol / libsignal or MLS). The server stores ciphertext only.
  - Album grants: `{ owner, grantee, grantedAt, revokedAt }`.
  - Album requests: `{ from, to, status }`.
- **Places / Events / Groups / Rooms**: CRUD, check-ins with TTL, "I'm going" intent, RSVP, group membership, room messages. Rooms are moderated, not E2E.
- **Trips**: `{ userId, city, lat, lon, arriveAt, nights }`. Locals see "Arrives Fri" and can message before arrival.
- **Moderation**:
  - Reports `{ reporter, target, reason, details, evidence(optional, client-decrypted) }`.
  - Actions `{ step, reason, ruleRef }`.
  - Appeals reviewed by a different moderator.
- **Notifications**: kinds `match`, `album`, `arrival`, `status`, `safety`, respecting per-kind preferences. Delivered by web push / APNs / FCM.

## Backend & integrations to implement
| Area | Recommendation |
|---|---|
| Auth | NextAuth/Auth.js with Google + Apple; magic-link email; anonymous accounts (device-bound, upgradeable) |
| Age check | Yoti / Persona / Veriff age estimation with ID fallback; store only the 18+ boolean |
| Realtime | Supabase (Postgres + PostGIS + Realtime) or Postgres + Redis + WebSockets |
| Geo | PostGIS for nearby/hotspots (grid clustering ≈ the prototype's 0.004° × 0.005° cells, ≥3 people) |
| Maps | CARTO Basemaps `dark_all` raster (`https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=KEY`) once the key is **activated** (the provided key currently returns the watermark tile). Keyless fallback used in the prototype: Esri `Canvas/World_Dark_Gray_Base` + `World_Dark_Gray_Reference`. Never use tile.openstreetmap.org (it blocks embedded apps). Keep the attribution visible. Prefer MapLibre GL in production |
| City search | Photon (`photon.komoot.io/api/?q=&osm_tag=place`) with Nominatim fallback, or a paid geocoder at scale |
| Messaging | libsignal / MLS for 1:1 E2E; per-message sealed sender |
| Media | Signed-URL storage (S3/R2); strip EXIF/GPS; server-side blur variants; album access checked per request |
| Payments | Stripe Billing (web) + StoreKit / Play Billing (apps). Plans: Free $0, Plus $5/mo, Premium $10/mo. Statement descriptor "PRK Digital" |
| Moderation | Queue + human review; AI assist for spam, scams, CSAM hashing (PhotoDNA), harassment. Warning → limit → suspend → remove ladder with appeal |
| Support | Human helpdesk (e.g. Intercom/Zendesk) in PT + EN; SLA < 24h, Premium < 4h |
| Risk regions | Country list in the prototype (`FLAGGED`); force Area precision, blur photos until mutual, flag fast meetups |
| Privacy | GDPR/LGPD/US-state compliance; data export (JSON) and deletion within 30 days; no ads, no data sales |
| Disguise | PWA manifest / native alternate icons (Calculator, Weather, Notes); PIN stored as salted hash; lock on `visibilitychange` |

## Interactions checklist
- Statuses expire automatically, with a notification 10 minutes before. The time scrubber recomputes availability as `startsAt ≤ T < endsAt`.
- Mutual interest unlocks photos, and chatting partially unblurs them. In risk regions, photos stay fully blurred until mutual.
- Album: request → accept (or not) → a card with thumbnails appears in the chat. Owners can revoke at any time. Plan limits are enforced on upload; downgrading hides extra photos rather than deleting them.
- Report means block + queue. The blocked user disappears from the map, chats and Pulse.
- Quick exit must be instant: no animation, and it clears any open sheets.
- All inputs keep 44px or taller hit targets on mobile. Filters and sheets are one-hand reachable from the bottom.

## Files
- `design/Piroka Homepage.dc.html`: homepage, sign-up chat, consent, face check.
- `design/Piroka Onboarding.dc.html`: 5-step onboarding.
- `design/Piroka App v2.dc.html`: the full app (current version).
- `design/Piroka App.dc.html`: v1, kept for reference only.
- `design/Piroka Help.dc.html`: help, support, appeals, report, policies.
- `design/Piroka Account.dc.html`: forgot password, magic-link sign-in, reset (routes `#forgot`, `#magic`, `#reset`).
- `design/support.js`: runtime needed to open the prototypes locally.
- `standalone/*.html`: single-file offline demos, one per screen. Links between screens only work in `design/`.
- `starter/`: `tailwind.config.ts` (tokens), `db/schema.sql` (Postgres + PostGIS), `lib/geo/fuzz.ts` (location privacy), `lib/intent.ts` (availability, rings, inbox buckets, blur), `.env.example`, `BUILD_PLAN.md` (phased prompts for Claude Code).

## Added since v1 of this handoff
- **Account** page: forgot password with a 30-second resend cooldown, magic link (expires in 15 minutes), and a reset screen with live password rules.
- **App v2**:
  - Phone verification by text code (a 6-digit code with a resend timer).
  - Photo verification with a live selfie and a random pose, with an upload fallback.
  - In-app **Edit profile** sheet.
  - Map loading, empty and location-error states.
  - A `:focus-visible` outline on all pages.
- **AI**: the Filter sheet's natural-language line and the support chat (Ana) call Claude when available, with the local parser and canned replies as fallback. In production, move both behind server routes; see BUILD_PLAN Phase 9.


## Added in handoff v3
- **Admin console**: `design/Piroka Admin.dc.html`.
  - Overview: KPIs, a daily-active-users chart and a "Needs attention" list.
  - **Reports**, sorted by severity, with an SLA: pick a rule, add a note, then Dismiss / Warn / Limit 24h / Suspend 7d / Remove. Remove is admin-only. Possible minors get an escalation warning.
  - **Appeals**: the moderator who made the original decision can't review the appeal.
  - **Verifications** (photo, health document, age ID fallback) and **Support** tickets with SLA countdowns and AI-drafted replies.
  - **Users** (limit/restore, reset sessions, GDPR export), **Places & testing** listings, **Risk regions** (admin-only toggles) and an **Audit log** of every action.
  - A role switch (Moderator / Admin) shows the permission differences.
- **Sexual health** (ME → Sexual health):
  - Fields: HIV status (Negative / Negative on PrEP / Positive undetectable (U=U) / Positive / Prefer not to say), last HIV and STI test (month), and prevention (PrEP, Doxy-PEP, condoms, Mpox/HPV/Hep B vaccines).
  - Visibility: Only me / People I share with / Everyone.
  - An explicit consent checkbox; the card can be deleted.
  - **Verification**: upload a lab result or clinic-app screenshot. AI returns only whether it's a test record, which tests and the month, never result values or names, and the image is discarded. Anything uncertain goes to human review (Admin → Verifications).
  - **Sharing**: "Share health" in any chat posts a health card, and tapping again unshares it. Profiles show shared or public cards, plus "Ask to see health card".
- **Legal guardrails** (confirm with counsel):
  - The fields are optional and never required to use the app, and nothing is inferred from them.
  - The data is treated as special-category data (explicit consent under GDPR Art. 9 / LGPD Art. 11), stored encrypted per user, never sent to advertisers or analytics, and excluded from staff views.
  - It's self-reported with no medical claims, and "Disclosure laws differ by place" is shown before saving.
  - Deletion propagates to every chat card.
  - Filtering by HIV status is not offered.
- **Testing tab** (Places → Testing): 8 real sample sites around Dallas 75219 (Kind Clinic Oak Lawn, CAN Community Health, Prism Health North Texas Oak Lawn and Oak Cliff, Oak Lawn UMC free testing, UT Southwestern CPIU, Dallas County HHS, The Stewpot), each with services, cost, notes, Directions (Google Maps) and Call. Map pins show "+". **Confirm hours and phone numbers before launch.**
- **Language**: EN / PT / ES in ME (defaults to the browser language). The prototype translates nav, top controls, intent chips and the scrubber; production should use next-intl with full string catalogs.
- **Ethnicity**: an optional, self-described profile field and filter (10 options). It can be turned off with the `ethnicityFilter` Tweak. Bios that put people down for their race are removed under the "No hate" rule.
- **Position marks**: original geometric glyphs on each pin, top-left corner (Top ▲ chevron up, Bottom ▼ chevron down, Vers ◆ diamond, Switch double chevron, Side — a horizontal bar), black disc with a white 1.5px ring. There's a legend and a "Hide marks" toggle in Filter. "Side" was added as a position.


## Added in handoff v4
- **Position marks, redesigned** as a *position slider*. Each pin carries a tiny vertical track with a knob, and the knob's height is where you sit on the Top ↔ Bottom spectrum:
  - Top: knob at the top.
  - Vers Top: upper third.
  - Vers: center.
  - Vers Bottom: lower third.
  - Bottom: knob at the bottom.
  - **Side**: a horizontal ↔ arrow (non-penetrative).
  - Switch: ⇅ opposing arrows.
  - Glyph: 19px black disc, 1.5px white ring, path stroke 3 on a 24 viewBox. A legend and a hide toggle are in Filter.
  - It's an original visual language (a spectrum dial), not a letter badge or colored pin.
- **πroka assistant** (always available on Map and Pulse: an "Ask πroka" pill that opens a chat panel):
  - Claude with three client tools: `set_filters`, `find_people` and `get_taste` (Premium). It applies filters from plain language, returns tappable people cards, writes openers and answers safety and feature questions.
  - Falls back to the local parser when AI is unavailable.
- **Your type (Premium)**:
  - πroka learns from behavior: profile open +1, Interested +3, chat +2, Next/skip −1.
  - Traits learned: position, body, age band, intent, gender, identity and interests. Ethnicity and health are never used.
  - Users can mark any trait ✓ like / ✕ not for me, or reset everything.
  - Match score = 50 + 50·tanh(Σ(weight·0.6 + like 6 / avoid −12) / 10), clamped 1–99.
  - Shown as a ring and "why" on profiles, with an "Only my type (70%+)" filter. Non-Premium users see a locked upsell.
- **Favorites**: ☆/★ on every profile, and a Favorites list in ME with live status. **Online alerts for favorites are Premium** (push + in-app).
- **Plans**: Premium now reads "πroka learns your type + match scores · Alerts when favorites come online · Priority support under 4h · Who viewed and liked you".
- **Travelers**: arrival pins are a dashed circle with a solid airplane and the origin flag. Pulse "Arriving soon" rows show the flag. Visiting badges use the same airplane.
- **Where you're from**: an optional field in Edit profile (50 US states + DC, 33 countries). It shows a flag on the profile ("From Texas" / "Coming from Brazil") and in the ME header. Flags come from flagcdn.com (`https://flagcdn.com/{iso2 | us-xx}.svg`); self-host them in production.


## Chemsex / PnP policy (v4.1)
- **Not built on purpose:** any "party"/PnP intent, tag, filter, search or matching. Facilitating drug use is illegal, violates App Store and Google Play rules, and creates liability. Moderation removes drug offers and requests, including coded words and emojis (new Community Guidelines rule: "No drugs for sale or arrangement").
- **Built:** ME → Sexual health → **Chemsex & party safety**:
  - Never alone, overdose response, GHB/GBL, stimulants and mixing, consent and aftercare.
  - Quick actions: Call 911, Never Use Alone (1-800-484-3731), find naloxone, set a check-in timer, SAMHSA (1-800-662-4357), 988, and PEP → Testing tab.
  - The same content is in Help → Safety Center.
  - The assistant gives harm-reduction answers and refuses to help find or arrange drugs.
- **Production:** partner with local harm-reduction organizations (e.g. Dallas-area syringe services and naloxone programs) and have public-health staff review the copy.


## Added in handoff v5
- **Upgrade and feature banners**:
  - A dismissible card above the time scrubber on the Map, with a green icon tile, title, sub-line, CTA and ×.
  - Free / Anonymous accounts see at most 4 per session (every ≥90s, auto-hide after 12s). Paid accounts see only feature tips, at most 2 per session.
  - After 2 dismissals, no more are shown that session.
  - Content: Premium (your type, favorite alerts), Plus (trips, 5 album photos), and tips (Quick exit, free testing).
  - Never shown over sheets, profiles or the assistant.
- **Describe box in Filter**: a large green-tinted card with a 3-line textarea (16px on mobile to avoid iOS zoom), an explicit **Apply** button, and Enter to apply (Shift+Enter for a new line).
- **Mobile**:
  - Inputs, selects and textareas are 16px under 820px.
  - The bottom tab bar respects `env(safe-area-inset-bottom)`.
  - The assistant opens full-screen on mobile.
  - Sheets scroll through an inner wrapper so controls never shrink.
  - Verify on real devices (iOS Safari, Android Chrome) at 360–430px wide.
- **Comfort levels** (Edit profile → Health practices): Substance-free / No chems-PnP / No poppers / No tobacco / Alcohol is fine, nothing else / Let's discuss. These are boundaries, not offers.
- **Ambassadors**:
  - App: a ME card to apply (city, motivation, hours per week, code of conduct), shown as "in review" then approved.
  - Ambassador tools: a city queue (profiles, room messages and events) with *Looks fine* / *Hide & escalate*, and welcome new members.
  - An "Ambassador" trust badge on profiles.
  - Admin → **Ambassadors**: approve or decline applications. For active ambassadors it shows the number of actions and their % agreement with moderators, and removing an ambassador is admin-only.
  - Powers: hide pending review, verify events and places, welcome members. Ambassadors can't ban, see reports about themselves, or see private data.
- **Events around you**: tonight's events appear on the map as calendar pins with the start time, next to their venue. Pulse has a "Happening around you" list, and tapping opens Places → Events.


## Added in handoff v6
- **Your own pin**: your main photo in a 54px pin. The green ring shows the time left on your status, with a "You" / status label underneath, a pulse, and the blurred-location circle behind it.
- **Error states**:
  - An offline banner.
  - Messages sent offline show as faded with "Not sent · Tap to retry".
  - Card declined: in the demo, a card number ending in 0002 is declined, and the user is told they weren't charged.
  - Account **Limited** (banner with appeal link) and **Suspended** (blocking screen with the reason and appeal) states, switchable through the `accountState` Tweak.
- **Photo moderation**: new album uploads show "In review…" and then either approve or show "Removed · shows another person". In production this comes from the moderation pipeline.
- **Who's interested (Premium)**: ME card → a sheet with "Viewed you" / "Liked you" tabs. It's blurred with an upsell for other plans.
- **Notifications**:
  - Quiet hours (from/until). Only safety alerts get through during quiet hours.
  - **Discreet previews**: a lock-screen preview that follows the disguised icon ("Calculator · You have a new notification").
- **Video before meeting**: "Video (blurred)" in mutual chats. Both sides start blurred and each person taps "Unblur me". Labeled "Encrypted · not recorded", with Report and End. Uses the real front camera when allowed.
- **Onboarding on mobile**: sticky bottom actions with safe-area padding, grids that wrap, and 16px inputs.
- **i18n catalogs**: `starter/i18n/en.json`, `pt-BR.json`, `es.json` (nav, intents, map, profile, chats, ME, sheets, AI, plans, safety). Use them with next-intl.
- **Invites**: a ME card with a personal code and Share/Copy link. Both people get 1 month of Plus after the new person passes the age check.
- **Public event page**: `design/Piroka Event.dc.html` (`#e0`, `#e1`, `#e2`). It works outside the app: date tile, venue, going count (names private), "RSVP in πroka", Share, Directions and an 18+ note. Events in the app link to it.
- **Partner dashboard**: `design/Piroka Partners.dc.html`, for venues and clinics.
  - Stats (totals only).
  - Hours editor per weekday.
  - Services/offer tags.
  - "Post an event" (reviewed by an ambassador).
  - The partner's events with status and a public page link.
  - Linked from ME ("For partners").


## Added in handoff v7
- **Plan & billing** (ME → Plan → "Billing & receipts"):
  - Current plan card with renewal date, Change plan and Cancel.
  - **Retention step** before cancelling: pause for 1 month, switch Premium → Plus, or cancel anyway. After cancelling, the user keeps the plan until the renewal date; "Resume subscription" undoes it.
  - Payment method: brand and last 4 digits, with add/update card.
  - Billing email.
  - **Promo codes**: `PRIDE26` or any `PIROKA-…` invite code gives 1 month of Plus.
  - **Receipts**: a list with a downloadable HTML receipt (statement name "PRK Digital").
  - A note for App Store / Play subscribers to manage the subscription in the store.
  - Stored in `localStorage.piroka_billing` in the prototype. Production: Stripe Billing Portal + webhooks, Apple and Google server notifications.
- **Hover preview (desktop)**: pointing at a person pin shows a 224px card without clicking:
  - A large photo, blurred until mutual.
  - Intent and time left, "% your type" (Premium), name, age and origin flag, position · body · distance, and "Click to open profile".
  - It flips side near the edges and only shows on devices that support hover (`(hover: hover)`).


## Added in handoff v8
- **Local board** (CHATS → "Local board" tab): a city feed within 5 miles.
  - Compose (280 characters, drug words blocked).
  - Quick chips: I'm hosting / I'm couchless / Heading out.
  - Filters: All / Hosting / Couchless / Going / Posts.
  - Posts appear **automatically** when someone goes live as Hosting, Couchless, Can travel or Available, or confirms "I'm going" to a place (with the place and ETA).
  - Each post has Message and Profile actions. Posts expire after 24h.
- **ME header** now has direct **Edit profile**, **Plan & billing** and **Health card** buttons.
- **Desperate alert (Premium)**: a red flame button next to the status pill.
  - Sends an alert to people nearby for 30 minutes, once every 3 hours.
  - On press: a red edge flash and a "DESPERATE ALERT SENT" card showing the people reached.
  - While active: your pin ring turns red, a red "You're desperate · mm:ss left · Stop" banner shows, and a DESPERATE post goes on the board.
  - Responses arrive as notifications.
  - Others see a red "X is desperate · distance · intent" banner with See.
  - Non-Premium users get the upsell.
- **Match flow**: incoming "Interested" is anonymous ("Someone nearby is interested"). Identity is revealed only on a mutual match: a white edge flash, rising grayscale emojis, and an IT'S MUTUAL card with "Say hi".
- **Declutter**:
  - One **Layers** menu holds Demand heat map, Places & events and Travel.
  - The time scrubber collapses into a pill.
  - The assistant is a π circle button.
  - Profile action buttons are 40px.
- **Places heat**: colors go from green to red with visits and "I'm going" confirmations. Packed places blink.
- **Travel radius** (1–15 mi) on Can travel. New intent **Couchless** for people who can't host or travel.
- **No-show rule**: "I'm going" asks for an ETA and expects a check-in. Two no-shows pause it for 5 days.
- **Demand heat map**: a density overlay that is red for high demand and transparent where it's empty.
- Demo Tweak `fastClock` runs time 30× faster.
