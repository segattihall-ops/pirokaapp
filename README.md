# πroka — Know who’s ready.

Intent-first live map for queer adults. Web/PWA first, native later. Built by XRankFlow Media Group.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS (tokens in `tailwind.config.ts`) · Framer Motion · Three.js (`@react-three/fiber`, `drei`) · MapLibre GL · TanStack Query · Zod · Supabase (Postgres + PostGIS + Realtime) · Vercel.

## Run

```bash
npm install
cp .env.example .env.local   # all keys optional in Phase 0
npm run dev                  # http://localhost:3000
```

`npm run build` · `npm run lint` · `npm run typecheck` · `npm run format`

## Routes

| Route | Screen | Phase |
|---|---|---|
| `/` | Homepage: live map, chat sign-up, 18+ consent, face age check, log in | 1 ✓ |
| `/onboarding` | 5-step profile setup | 0 shell → 2 |
| `/app/map` | Live map (default tab) | 0 shell → 3 |
| `/app/pulse` | Stats, hotspots, arrivals | 6 |
| `/app/chats` | Smart inbox, threads, local board | 4 |
| `/app/places` | Places · Events · Groups · Testing | 6 |
| `/app/me` | Profile, PIROKA Mode, SafeMeet, album, plan | 2, 5, 8 |
| `/account/forgot` `/account/magic` `/account/reset` | Account flows | 1 ✓ |
| `/help/[slug]` | Help center, support, appeals, report, policies | 7 |

App shell: 80px left rail at ≥820px (`rail:` breakpoint), 66px bottom tab bar below that, with `env(safe-area-inset-bottom)`.

## Auth and the 18+ gate (Phase 1)

Auth is Supabase Auth (Google, Apple, email magic link, anonymous, password). Without `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` the app runs in **demo auth** (a signed cookie, no real identity) so the whole flow can be walked locally; production builds refuse demo mode unless `NEXT_PUBLIC_AUTH_DEMO=1`.

Every new account passes the gate before `/onboarding` and `/app/*` (enforced in `middleware.ts`):

1. Two confirmations (18+, Terms/Privacy/Guidelines) → `POST /api/consent`.
2. Age check → `POST /api/age/verify`. Providers in `lib/age`: `yoti`, `persona` (stubs to wire) or `local` (the on-device UI only, dev). Only `age_verified = true` is stored, in Supabase `app_metadata` via the service role.

To go live on Supabase: set the keys plus `SUPABASE_SERVICE_ROLE_KEY`, enable Anonymous sign-ins, configure Google and Apple providers, add `<origin>/auth/callback` to the redirect allow list, and pick an age provider.

## Layout

```
app/            routes (App Router)
components/     shared UI (logo, app nav, providers)
lib/            intent.ts, geo/fuzz.ts (server only), help.ts, i18n.ts, env.ts, supabase/
messages/       en · pt-BR · es catalogs
supabase/       schema.sql (Postgres 15 + PostGIS)
design_handoff/ the design spec — README, FEATURES, BUILD_PLAN, HTML prototypes (source of truth for UI)
```

## Spec

Read `design_handoff/README.md` first. The `.dc.html` prototypes in `design_handoff/design/` are the behavioral spec (open with `support.js` beside them); `design_handoff/standalone/` are single-file offline demos. Build order is `design_handoff/starter/BUILD_PLAN.md`.

## Rules that never bend

1. Raw coordinates never leave the server. Public positions come from `lib/geo/fuzz.ts` only.
2. Statuses, check-ins, meets and location retention expire on their own.
3. Chat is E2E encrypted; the server stores ciphertext only.
4. Every new account passes 18+ consent and an age check before the app.
5. No chemsex/PnP intents, tags, filters or matching. Harm-reduction content only.
