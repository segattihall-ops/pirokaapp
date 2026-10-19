# πroka — Pin anatomy (App v2)

Source of truth: `design/Piroka App v2.dc.html` + `DESIGN_TOKENS.md`. Implementation helpers: `lib/map/pin-anatomy.ts`. Respect the actual backend; no invented users, response times, travel times, match scores or crowd counts.

## Person — 44px portrait, conic availability ring
- **Ring:** green `#34d399` = Available now, Next hour, Hosting, Can travel; white `#f5f5f5` = Tonight, Later, Visiting; gray `#666666` = Just looking. Arc decreases by elapsed status time.
- **Photo:** stranger 11px blur, chatted 5px, mutual/authorized Meet Mode clear if source image is actually accessible. Higher-risk regions keep blur until mutual. Being online/verified never unblurs a photo.
- **Position glyph:** white on black 19px badge top-left: Top, Vers Top, Vers, Vers Bottom, Bottom, Side, Switch.
- **Intent badge:** white disc bottom-right, SVG house/arrow/plane/crossed-out couch. Red blinking `#ef4444` ring only in Desperate.
- **Hover:** pointer-capable desktop only, 224px card, photo 210px, flips when near map edge. Include intent/duration, optional Premium stored score, name, optional age and origin flag, position/body, `approx` distance and response time **only when backend data is known**. Tap opens profile on mobile.
- **Distance:** public `approx` displays rounded `~1.2 mi` (minimum 0.1 mi). Precise feet/miles require accepted Meet Mode and are never exposed by the public nearby response.
- **Time:** `dur` displays `2h 15m` or `40m`.

## Traveler
- White dashed circular pin, solid airplane SVG; state/country flag only when explicitly supplied.
- `tripText` displays `Arrives Fri 3 PM → Mon 11 AM` only when arrival/departure clock times exist. Older trips without stored times show the days, not fabricated 3 PM/11 AM defaults.
- Full itinerary displays local arrival/departure dates with times and calculated nights in ME → Trips. Selected destination travel radius 1–15 mi is displayed as `Can travel · up to 5 mi` to other people.
- Store only city-level travel coordinates; never publish address or precise traveler GPS.

## Place / event / testing
- White/gray pins, **never rainbow-coded**. A white conic ring expresses activity.
- Heat formula: `min(1, (here + arriving×1.5 + (going ? 1.5 : 0) + (checked ? 1 : 0)) / 45)`. Do not double count check-ins already included in `here`.
- Labels: Chill (<.35), Lively (≥.35), Busy (≥.6), Packed (≥.8). Place pin has white type glyph and real current headcount. Event pin has neutral calendar + time; testing pin neutral shield/cross + cost (Free when genuinely free).
- Popping: red flame badge only after 5 **distinct active on-site** taps on “It's popping!”; do not fabricate votes.

## Your pin
- 54px main photo, green shrinking time ring, You/current-status pill, approximate dashed location-fog halo; red blinking outside ring in Desperate.
- A hidden location should not leave a visible pin; public map positions are fuzzed server-side and never raw.

## Responsive and verification
- Design at 390px first. Tap targets at least 44px. No hover card on touch devices.
- Render only verified backend values. Check screen parity, accessibility, expired timers, location privacy and fallback states before merging PR #30.
