# πroka — design tokens (fixed style rules)

Use ONLY these values. Don't invent colors, radii, shadows or fonts. Mirrors the prototype (`design/*.dc.html`) and `starter/tailwind.config.ts`.

## Color — meaning is fixed
| Token | Hex | Use |
|---|---|---|
| Ink 950 | `#070707` | App background |
| Ink 900 | `#0a0a0a` | Panels, sheets |
| Ink 850 | `#0e0e0e` | Cards, inputs |
| Ink 800 | `#111111` | Select/menu bg |
| Ink 750 | `#1a1a1a` | Avatar/placeholder bg |
| Green | `#34d399` | **People available + brand**: CTAs, rings, accents, selected state |
| Green hover | `#6ee7b7` | Link/CTA hover |
| White | `#f5f5f5` | Primary text, place pins |
| Text-2 | `#cccccc` | Secondary text |
| Text-3 | `#999999` | Muted text |
| Text-4 | `#666666` | Hint text, disabled |
| Danger / Desperate | `#f87171` (red `#ef4444` for Desperate ring + popping flame) | Destructive + Desperate ONLY |
| Warning | `#fbbf24` | Safety / higher-risk banners |

Rule: green = available, red = Desperate only, white/gray = places/events/testing, amber = safety. Never color places with a rainbow heat scale — places are neutral white + headcount + flame when popping. Demand layer is green-intensity only.

**Lines/borders:** `rgba(255,255,255,0.06)` hairline · `0.1` default · `0.14` stronger.
**Selected pill/card:** border `rgba(52,211,153,0.75)` + fill `rgba(52,211,153,0.14)`.

## Type
- Family: **Geist** (`https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700`), mono **Geist Mono** for IDs/receipts. Fallback `ui-sans-serif, system-ui, sans-serif`.
- Sizes: h1 32px/600/-0.03em · h2 24–26px/600/-0.03em · section 15px/600 · body 14px/1.5 · label 12px · eyebrow 11px/700/0.14em · nav 9px/600/0.08em.
- Inputs **16px** under 820px (prevents iOS zoom). Never below 24px text on the homepage globe copy.

## Radius
chip/pill `999px` · input `12–13px` · button `14px` · card `20px` · sheet top `26px` · hero/profile card `28px`. Pins/avatars are circles.

## Shadow (bluish-black, never flat gray)
- Float: `0 18px 50px rgba(0,0,0,0.5)`
- Side panel: `-30px 0 80px rgba(0,0,0,0.55)`
- Bottom sheet: `0 -30px 80px rgba(0,0,0,0.6)`
- Green glow (accent): `0 0 30px rgba(52,211,153,0.15)`

## Spacing — 8px base
`4 · 6 · 8 · 10 · 12 · 14 · 16 · 18 · 22 · 26`. Card padding 14–18px. Panel padding 16px. Lay out groups with flex/grid + `gap`, not margins.

## Layout
- Left rail 80px on desktop; bottom tab bar (5 tabs: MAP · PULSE · CHATS · PLACES · ME) with `env(safe-area-inset-bottom)` on mobile.
- Chat / profile / Pulse / Places open as a **380–420px right side panel** over the map on desktop, **full-screen** on mobile, each with a close ×.
- Mobile-first: design at 390px first; everything wraps and scrolls (inner wrapper in sheets so controls don't shrink).

## Motion
Durations 140/220/420ms, ease-out, no bounce. CTA hover = brightness only, no scale. Entry `piIn` (fade + 10px rise). Status rings use `conic-gradient(green <deg>, rgba(255,255,255,0.12) 0)`.

## Buttons
- Primary: bg `#34d399`, text `#070707`, 600 weight, radius 12–14px, height 44–48px.
- Outline: transparent, border `rgba(255,255,255,0.14)`, text `#f5f5f5`.
- Ghost/subtle: transparent, text `#999`, no border.
- Send: 40px green circle with an up-arrow icon.

## Icons
Inline SVG, stroke `currentColor`, `stroke-width` 2 (2.2–2.4 small), rounded caps/joins. No emoji in UI (the only exception: grayscale sexual-emoji confetti on a mutual match). Position marks: a vertical slider glyph (knob height = Top↔Bottom), `↔` for Side, `⇅` for Switch.
