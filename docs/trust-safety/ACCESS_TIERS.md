# Access tiers — who can do what

πroka uses a **two-tier** access model. Age/ID verification is not a front-door gate; it is
required only when a member wants to **participate**. This is enforced server-side in
`middleware.ts` (fail-closed: anything not explicitly opened to un-verified users requires the
age check).

## Tier 1 — signed in, no age check (the SFW "look around")

Anyone signed in — **including an anonymous visitor** — may browse the safe-for-work surface:

- The live map (other members appear with photos **blurred**).
- Places, events, pulse/heatmap, leaderboard.
- Member profiles — the profile API (`/api/users/[id]`) serves **pre-blurred** photos to anyone
  who is not the owner, so browsing a profile reveals nothing explicit.
- The area board (read).

Pages: `/app/**`. APIs: `API_SFW_READ` (GET only) plus `API_PREGATE` (auth, consent, age,
telemetry, account hygiene, webhooks, jobs).

An anonymous visitor lands straight on `/app/map` after choosing "Stay anonymous" — no consent
chat, no age check.

## Tier 2 — signed in AND age-verified (participation)

The 18+ / ID check (Didit) is required before a member can:

- **Chat** or ring (`/api/chat/**`).
- **Post / become visible** — publish location to appear on the map (`POST /api/me/location`),
  upload photos, set a status, post to the area board, vote/check-in at places, attend events.
- **Albums** — request, grant, or open a private album (`/api/album/**`).
- **Meet Mode** (`/api/meet/**`).
- **Convert to a real account** — signing up with Google or email (anonymous → identified).

Pages: `/onboarding`, `/admin`, `/partners`. APIs: everything not in the Tier-1 lists.

## Why explicit photos don't need their own tier

Explicit photos are gated by **privacy**, not just age: the profile API only releases a member's
clear main photo on a **mutual chat or an accepted Meet**, and album photos only on an **album
grant**. Every one of those is a Tier-2 action, so by the time anyone can see another member's
explicit photos they are already age-verified. Browsing strangers only ever shows blurred images.

This also keeps the public claim true: **all content creators are verified 18+**, because posting
any photo is Tier 2.

## Compliance note

Moving the age check off the front door is a deliberate product decision. Some jurisdictions
(several US states, the UK Online Safety Act, others) require age assurance before access to adult
material. Because strangers only ever see blurred photos and all posting requires full
verification, the adult-content surface stays behind the 18+ check; the relaxation applies to the
SFW browse surface only. Revisit this with counsel if the blur/privacy rules above change.
