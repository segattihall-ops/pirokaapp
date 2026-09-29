# πroka — full feature list

πroka is an intent-first live map for queer adults, with the tagline "Know who's ready." Every feature below is built in the HTML prototypes in `design/`.
★ = Premium · ✚ = Plus or Premium · everything else is free.

## 1. Homepage & access (`Piroka Homepage`)
- Animated 3D globe built from real map tiles, plus an intro animation.
- Sign up through a chat: Google, Apple, email magic link or anonymous. There's also a regular log-in form.
- Required for every new account: two checkboxes (18+, terms) and a face age check (live camera, with a photo-ID fallback).
- Footer links go to every policy page.

## 2. Account access (`Piroka Account`)
- Forgot password, with a 30-second resend cooldown.
- Magic-link sign-in (expires in 15 minutes).
- Password reset with live strength rules.

## 3. Onboarding (`Piroka Onboarding`)
1. Display name or anonymous, plus pronouns (preset or custom).
2. 66 identity options (gender, orientation, communities), searchable.
3. "Show me" (Men, Women, Trans women, Trans men, Non-binary people, Everyone), plus safety defaults.
4. A main photo and 2 album photos, or stay faceless.
5. Location permission, visibility (Neighborhood / Area / Hidden) and a disguised app icon.

## Color system
Each color has one meaning: **green** = people available (the brand color), **red** = only Desperate (blinking), **white/gray** = places, events and testing sites, **amber** = safety warnings.

## 4. Map (`Piroka App v2` → MAP)
- A real dark map: drag, zoom, and "locate me".
- **Your pin** (tap → "Your profile" card with Edit profile, Set intent, Health card, Plan & billing): your photo inside a status-time ring, with the "You" label, a blurred-location fog circle, and a blinking red ring while Desperate is active.
- **Person pins**:
  - A ring whose color shows intent and whose length shows time left.
  - Progressive photo blur (stranger → chatted → mutual).
  - Intent badges: Hosting, Can travel, Visiting, Couchless.
  - Position marks: Top, Vers Top, Vers, Vers Bottom, Bottom, Side, Switch.
- **Desktop hover preview**: large photo, intent and time left, match %, flag, position · body · distance.
- **Place pins**:
  - Neutral white pins with type glyphs (bar, club, sauna, park, café, gym).
  - A white ring fills with activity, and the badge shows the headcount.
  - A small **flame badge** appears when 5+ people who are there tap **"It's popping!"**.
- **Event pins** (tonight), **testing-site pins**, and **traveler pins** (airplane + origin flag).
- **Intent chips**: Everyone / Now / Tonight / Hosting / Visitors.
- **Time scrubber** from Now to +6h, collapsed into a pill by default.
- **Layers menu**:
  - **Demand heat map**: green intensity only (faint → strong), transparent where it's empty; off by default.
  - Places & events on/off.
  - Travel.
- **Filter**:
  - A large "Describe who you're looking for" box that uses AI.
  - Age range, Show me, Position, Body, Identity, Ethnicity (can be turned off with a Tweak), Orientation, Looking for.
  - ★ Only my type (70%+).
- **Status (PIROKA Mode)**:
  - Available now, Next hour, Hosting, Can travel (1–15 mi radius), Tonight, Later, Visiting, Just looking, **Couchless** (can't host or travel).
  - Duration from 30 minutes to 4 hours; statuses expire on their own.
- **★ Desperate**:
  - A red alert to people nearby for 30 minutes, once every 3 hours.
  - A screen flash and "ALERT SENT" card, a red countdown banner, and a board post.
  - Responses arrive as notifications, and others see a red "X is desperate" banner.
- **"Someone nearby is interested"**: an anonymous alert. Identity is revealed only on a mutual match, with a flash, grayscale emojis and an "IT'S MUTUAL" card.
- Upgrade and feature banners for Free users, frequency-capped and dismissible.
- Safety banners: offline, higher-risk region, account limited or suspended.

## 5. Pulse
- Stats: Available now, Hosting, Tonight, Visitors.
- Hotspots that "breathe" on the map, with ↑ or ↓ trend.
- "Happening around you" events.
- Arriving soon, with origin flags and "Say hi →".
- Trending places.

## 6. Places (Places · Events · Groups · Testing)
- **Places**:
  - A heat legend, and a place detail page (here now / on the way / visitors / peak time).
  - Check in, and "I'm going" with an ETA (15 min / 30 min / 1 hour).
  - **Automatic check-in on arrival.**
  - **Two no-shows pause "I'm going" for 5 days.**
  - "It's popping!" votes.
  - A live place chat.
- **Events**: RSVP, and a shareable public page (`Piroka Event`).
- **Groups**: 8 communities, join/leave, group chat.
- **Testing**: 8 real sample clinics around Dallas 75219, with services, cost, directions and phone.

## 7. Chats (a compact 380px side panel over the map with a close ×, so alerts stay visible)
- **Messages**:
  - Smart inbox: NOW / MUTUAL / ACTIVE / LATER / EXPIRED, with a live context line on each chat.
  - "End-to-end encrypted" label, and a failed-send "retry" when offline.
  - A **⋯ menu** with Request album, Unlock my album, Share health, Video (blurred), Report, Profile and Propose meet.
  - Album and health cards appear inside the conversation.
- **Local board**:
  - Posts within 5 miles (280 characters, drug words blocked).
  - **Automatic posts** when someone starts Hosting, Couchless, Can travel or Available, confirms "I'm going", or sends a Desperate alert.
  - Filters: All, Hosting, Couchless, Going, Posts. Each post has Message and Profile actions.
  - **★ Premium members can reply publicly to other Premium members' posts** (threaded replies).
- **Pre-meet video**: both sides start blurred and each person unblurs; not recorded.
- **Meet Mode**:
  - Precise location is shared for 2 hours, with an animated line between you and the ETA.
  - **SafeMeet**: check-in timer, trusted contact, and Block & report.

## 8. Profiles
- Photo with progressive blur, intent and time left, and origin flag ("From Texas" / "Coming from Brazil").
- Stats and trust badges: Ambassador, Human, Photo, Phone.
- ★ Match score with the reasons.
- Shared health card, and "Ask to see health card".
- Album (locked until the owner shares it), Request album, Report / Block.
- Response-time indicator ("Replies in minutes · 92% reply rate").
- Compact actions: Chat · ☆ Favorite · Interested · Next.

## 9. ME
- Header with name, flag and pronouns, plus **Edit profile · Plan & billing · Health card** buttons.
- **Edit profile**:
  - Name or anonymous, pronouns, bio, where you're from, gender, show me.
  - **Stats**: age, height, weight, endowment, body type.
  - **Identity**: expression, sexuality, position.
  - **Health practices & preferences**: practices, safeguards, comfort levels, I carry.
  - An eye icon on each field to show or hide it.
- PIROKA Mode and visibility; trust verifications (phone text code, live-selfie photo check).
- SafeMeet settings; Trips (✚ saving; "Look now" is free); city search.
- **Your album**: 2 photos (Free / Anonymous) or ✚ 5, with a moderation state (in review / removed).
- **★ Your type**: learned traits with ✓ like / ✕ not for me, and reset.
- **Favorites**, with ★ online alerts.
- **★ Who viewed / liked you.**
- **Invite friends**: both get 1 month of Plus.
- **Sexual health card**:
  - HIV status, test dates, prevention, visibility and consent.
  - AI checks an uploaded test document (month and test type only), or sends it to human review.
- **Chemsex & party safety**: harm reduction, 911, Never Use Alone, naloxone, SAMHSA, 988, PEP.
- **Language**: EN / PT / ES.
- **Become an ambassador**: application, ambassador tools and a badge.
- **Privacy & safety**:
  - Disguised icon, PIN lock, quick exit (Esc twice → decoy weather screen).
  - Notification types, quiet hours, discreet previews.
  - Blocked list, data download, account deletion.
- Links: Help, Terms, Privacy, Guidelines, For partners, Staff.

## 10. Plans & billing
- Plans:
  - **Free**: map, chat, filters, communities, events, SafeMeet, 2 album photos.
  - **✚ Plus ($5)**: 60+ identity filters, saved trips, unlimited history, 5 album photos.
  - **★ Premium ($10)**: everything in Plus, plus your type and match scores, Desperate alerts, favorite online alerts, who viewed or liked you, priority support.
- Checkout, a declined-card state, and a success screen.
- **Billing**:
  - Renewal date, change plan, cancel with a retention step (pause or downgrade), resume.
  - Card on file, billing email, promo codes (PRIDE26 / invite codes), downloadable receipts.

## 11. πroka assistant (AI)
- The π button on the Map and Pulse opens an AI chat.
- It sets filters, finds people, writes openers, and answers safety and feature questions.
- ★ It knows your type.
- It gives harm-reduction answers and refuses to help find or arrange drugs.

## 12. Help & Legal (`Piroka Help`)
- Searchable help center.
- Human support chat (PT / EN, powered by AI in the prototype).
- Account standing (moderation ladder + appeal), and a report form that works without an account.
- Community Guidelines (including "no drugs for sale or arrangement"), Safety Center (including chemsex safety), Terms, Privacy, and the 2257 statement.

## 13. Admin console (`Piroka Admin`)
- Overview: KPIs, a daily-active-users chart, "needs attention".
- Reports: severity + SLA, rule selection, warn / limit / suspend / remove.
- Appeals, reviewed by a different moderator than the original decision.
- Verifications and support tickets (with AI-drafted replies).
- **Ambassadors**: approve applications, agreement rate.
- Users (limit, reset sessions, GDPR export).
- Places & testing listings, risk regions, audit log.
- Moderator / Admin roles.

## 14. Partner dashboard (`Piroka Partners`)
- For venues and clinics: stats (totals only), hours per weekday, services/offer tags, posting events (reviewed by an ambassador), their events with public pages.

## 15. Platform & quality
- Mobile-first: bottom tab bar with safe areas, 16px inputs, full-screen assistant on mobile, sheets that scroll without shrinking.
- Loading, empty and error states; keyboard focus outlines.
- Demo Tweaks: map provider, ethnicity filter, planOverride, accountState, fastClock (30× time).
- Offline single-file demos in `standalone/`.
- Starter code in `starter/`: Tailwind tokens, PostGIS schema, location fuzzing, intent logic, i18n catalogs, `.env.example`, and a phased `BUILD_PLAN.md` for Claude Code.

## Simulated in the prototype (needs production services)
Other users and their replies, age estimation, OTP and photo matching, payments, moderation review, push notifications, E2E encryption, video calls, and AI (Claude runs client-side in the prototype). See `README.md` → "Backend & integrations" and `starter/BUILD_PLAN.md`.
