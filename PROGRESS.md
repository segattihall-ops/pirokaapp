# πroka Build Progress

## Phase 0 ✅ Complete
- ✅ Next.js 14 App Router + TypeScript + Tailwind CSS
- ✅ Geist font from Google Fonts
- ✅ Framer Motion, Three.js, MapLibre GL, Zod, TanStack Query
- ✅ Supabase JS client setup
- ✅ Routes structure: `/`, `/onboarding`, `/app/(map|pulse|chats|places|me)`, `/account/(forgot|magic|reset)`, `/help/[slug]`
- ✅ Global `:focus-visible` green outline
- ✅ Tailwind config with design tokens (colors, spacing, animations)

## Phase 1 🚀 In Progress
### Completed
- ✅ Auth.js (next-auth) installed and configured
- ✅ SessionProvider integrated into app
- ✅ Auth.js route handler (`app/api/auth/[...nextauth]/route.ts`)
- ✅ OAuth providers skeleton (Google, Apple config ready)
- ✅ Demo auth mode for local development (`.env.local` configured)
- ✅ Homepage component structure exists (`HomeClient`, `SignupChat`, `Intro`, `LiveMap`)
- ✅ 18+ + terms consent flow implemented in `SignupChat`
- ✅ Face age check UI implemented
- ✅ Account page structure exists with forgot/magic/reset flows
- ✅ Middleware with age gate verification

### In Progress
- 🔄 Testing homepage UI against design spec
- 🔄 Three.js globe fine-tuning (rotation, pulse, pause on hidden tab, reduced motion)
- 🔄 OAuth provider integration (Google/Apple keys required)
- 🔄 Email magic link provider (SendGrid/Resend config)
- 🔄 Anonymous auth flow
- 🔄 Age verification flow (Yoti/Persona SDK or local mode)
- 🔄 Account page full implementation
- 🔄 Chat sign-up card styling against design spec

### Still To Do (Phase 1)
- ⏳ Connect OAuth providers (requires keys: GOOGLE_CLIENT_ID/SECRET, APPLE_ID/SECRET)
- ⏳ Email magic link provider setup (requires EMAIL_SERVER/FROM or third-party API)
- ⏳ Age verification provider integration (Yoti/Persona - for now using local/mock mode)
- ⏳ Design refinements: exact spacing, colors, animations vs spec
- ⏳ Mobile testing at 390px width
- ⏳ Accessibility testing (44px tap targets, keyboard nav, contrast)

### Mocked/Demo Features (Phase 1)
- 🎭 Age verification: Running in `AGE_PROVIDER=local` mode (UI only, proves nothing)
- 🎭 OAuth: Will redirect without real credentials; demo mode uses signed cookies
- 🎭 Email magic link: Not sending real emails; demo mode creates session

## Required Environment Variables

### For Phase 1 (Demo/Local)
```env
# Next.js/Auth.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>

# OAuth (optional - leave empty to skip)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
APPLE_ID=
APPLE_SECRET=

# Age verification provider
AGE_PROVIDER=local  # Can be: local (demo), yoti, persona

# Demo auth mode
NEXT_PUBLIC_AUTH_DEMO=1
DEMO_AUTH_SECRET=<generate with: openssl rand -base64 32>
```

### For Production (Phase 1+)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from Google Cloud Console
- `APPLE_ID` / `APPLE_SECRET` — from Apple Developer
- `EMAIL_SERVER` — SMTP URL (e.g., `smtp://user:pass@smtp.gmail.com:587`)
- `EMAIL_FROM` — Sender email (e.g., `"πroka <no-reply@piroka.app>"`)
- `YOTI_CLIENT_SDK_ID` / `YOTI_PEM` — from Yoti or use Persona instead
- `PERSONA_API_KEY` — from Persona (age verification)
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase project
- `SUPABASE_SERVICE_ROLE_KEY` — for server-side auth operations

## Phases Pending (2–16)

### Phase 2 — Data + onboarding
- Apply database schema to Supabase
- Build `/onboarding` with 5-step profile setup
- EXIF stripping for photos

### Phase 3 — Map core
- MapLibre with CARTO dark_all
- User pins with intent rings
- Location fuzzing (never send raw coords to client)
- Real-time updates via Supabase channels

### Phase 4 — Profiles, chat, albums
- Profile blur based on relationship
- 1:1 chat with E2E encryption (libsignal)
- Album sharing and access control

### Phase 5 — Meet Mode + SafeMeet
- Precise location sharing (2h window)
- Check-in timer with push notifications
- SMS via Twilio for missed check-ins

### Phase 6 — Pulse, Places, Events, Groups, Trips
- PostGIS clustering for hotspots
- Place check-in and "I'm going" TTL
- Event and group features
- Photon city search for trips

### Phase 7 — Safety, privacy, moderation
- Risk region detection
- PIN lock and quick exit
- Moderation queue + admin console
- Reports, appeals and warnings ladder

### Phase 8 — Plans + notifications
- Stripe billing for Plus/Premium
- Web push notifications (VAPID)
- Notification center

### Phase 9 — AI
- Smart search with Claude validation
- Support draft replies
- Moderation assist (PhotoDNA, hate-speech flags)

### Phase 10 — Admin console
- Role-based access (moderator, admin)
- Report/appeal/verification queues
- Audit logging

### Phase 11 — Sexual health + testing
- Health card encryption (envelope key)
- Photo verification with Claude vision
- Testing site directory

### Phase 12 — i18n, ethnicity, position marks
- next-intl with en, pt-BR, es
- Ethnicity filter (feature-flagged)
- Position mark SVG sprite

### Phase 13 — Assistant, taste learning, favorites
- Claude-powered people search
- Taste vector learning
- Favorites and match scoring

### Phase 14 — Origins + flags
- Flag display for profiles and arrival pins
- Origin selection in edit profile

### Phase 15 — Growth, ambassadors, events
- Promo impressions tracking
- Ambassador queue and approvals
- Event pins on map

### Phase 16 — Launch polish
- Offline message queue (IndexedDB)
- Photo moderation status
- Pre-meet video (MediaPipe blur)
- Invite codes and referrals
- Public event page

## How to Run Locally

```bash
# Install deps
npm install

# Start dev server
npm run dev

# Open http://localhost:3000 in browser
```

## How to Deploy to Vercel

```bash
# Set env vars in Vercel project settings
vercel env add NEXTAUTH_URL https://your-domain.com
vercel env add NEXTAUTH_SECRET <generate: openssl rand -base64 32>
# ... (add other vars)

# Deploy
vercel deploy --prod
```

## Next Steps

1. ✅ Commit Phase 1 foundation
2. ⏳ Test homepage UI + auth flows against design spec
3. ⏳ Fine-tune Three.js globe and animations
4. ⏳ Implement OAuth providers (when keys available)
5. ⏳ Implement email magic link (when SMTP configured)
6. ⏳ Implement age verification provider (Yoti/Persona)
7. ⏳ Move to Phase 2: Database schema + onboarding
