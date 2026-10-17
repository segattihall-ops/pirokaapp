# πroka — working rules

## Style is fixed: follow `design_handoff/DESIGN_TOKENS.md`

Use **only** the values in `design_handoff/DESIGN_TOKENS.md` and the tokens in `tailwind.config.ts`
(mirror of `design_handoff/starter/tailwind.config.ts`). Never invent colors, radii, shadows or fonts —
even when a prototype uses a one-off literal, map it to the nearest token.

Prefer the Tailwind utilities over raw values:

- Colors: `ink-950/900/850/800/750`, `fg`/`fg-2`/`fg-3`/`fg-4`, `green`/`green-hover`, `danger`, `warning`,
  borders `line-1` (0.06) / `line-2` (0.1) / `line-3` (0.14), selected `sel-border` + `sel-fill`.
- Radius: `rounded-chip` (999) · `rounded-input` (13) · `rounded-btn` (14) · `rounded-card` (20) ·
  `rounded-sheet` (26) · `rounded-hero` (28) · `rounded-logo` (15). Pins/avatars are circles.
- Shadow: `shadow-float`, `shadow-panel`, `shadow-sheet`, `shadow-pin`, `shadow-glow`.
- Backgrounds: `bg-logo`, `bg-glass`, `bg-rail`.
- Breakpoints are `sm` (480) · `rail` (820) · `lg` (1100) · `xl` (1400) — there is **no `md`**.

Meaning is fixed: green = available/brand/selected · red = Desperate + destructive only ·
white/gray = places, events, testing · amber = safety. Status rings are
`conic-gradient(<color> <deg>, rgba(255,255,255,0.12) 0)`. Inline SVG icons, `stroke="currentColor"`,
no emoji in UI. Design mobile-first at 390px; the tab bar is 5 tabs (MAP · PULSE · CHATS · PLACES · ME).
