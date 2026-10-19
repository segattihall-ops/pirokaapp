/**
 * πroka App v2 authoritative SVG paths.
 * Exact vectors extracted from design_handoff/design/Piroka App v2.dc.html.
 * Render inline: viewBox 0 0 24 24; fill none; stroke currentColor;
 * strokeWidth ~2; rounded line caps/joins. Exceptions: filled flame/plane
 * on map pin artwork, and non-SVG disguise glyphs.
 * Keep semantic colour decisions in the consuming component.
 */

export const NAV_ICON_PATHS = {
  map: "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
  pulse: "M3 12h4l3-8 4 16 3-8h4",
  chats: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z",
  places: "M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6",
  me: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
} as const;

export const INTENT_ICON_PATHS = {
  hosting: "M3 11l9-7 9 7M5 10v10h14V10",
  travel: "M5 12h14M13 6l6 6-6 6",
  visiting: "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z",
  couchless: "M4 12v5h16v-5M6 12V9a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3M3 3l18 18",
} as const;

export const POSITION_ICON_PATHS = {
  Top: "M12 3.5v17M12 6.5m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
  "Vers Top": "M12 3.5v17M12 9.2m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
  Vers: "M12 3.5v17M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
  "Vers Bottom": "M12 3.5v17M12 14.8m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
  Bottom: "M12 3.5v17M12 17.5m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
  Side: "M3.5 12h17M7.5 8l-4 4 4 4M16.5 8l4 4-4 4",
  Switch: "M8 4v16M4.5 7.5 8 4l3.5 3.5M16 20V4M12.5 16.5 16 20l3.5-3.5",
} as const;

export const PLACE_ICON_PATHS = {
  bar: "M5 4h14l-7 8zM12 12v7M8 20h8M15.5 7.5h.01",
  club: "M4 14v4M8 10v8M12 5v13M16 9v9M20 12v6",
  sauna: "M8 4c-1.5 1.5-1.5 3 0 4.5s1.5 3 0 4.5M12 4c-1.5 1.5-1.5 3 0 4.5s1.5 3 0 4.5M16 4c-1.5 1.5-1.5 3 0 4.5s1.5 3 0 4.5M4 20h16",
  park: "M12 3 6.5 11H9l-3 5h12l-3-5h2.5zM12 16v5",
  cafe: "M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3.5v2.5M12 3.5v2.5",
  gym: "M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12",
} as const;

export const MAP_ICON_PATHS = {
  testing: "M12 3 4.5 6v6c0 4.3 3.2 8.2 7.5 9 4.3-.8 7.5-4.7 7.5-9V6zM12 9v6M9 12h6",
  event: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M9 14h2",
  flame: "M12 22c4 0 7-3 7-7 0-3-2-5.5-3.5-7-.2 2-1.3 3.3-2.5 3.8C13.5 8.5 12 5 9 2c.3 3-1.5 5.5-3 7.5A7.9 7.9 0 0 0 5 15c0 4 3 7 7 7z",
  plane: "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z",
  sendArrow: "M12 19V5M5 12l7-7 7 7",
} as const;

export const POSITION_MARKS = [
  { id: 'top', label: 'Top', path: POSITION_ICON_PATHS.Top },
  { id: 'vers_top', label: 'Vers Top', path: POSITION_ICON_PATHS['Vers Top'] },
  { id: 'versatile', label: 'Vers', path: POSITION_ICON_PATHS.Vers },
  { id: 'vers_bottom', label: 'Vers Bottom', path: POSITION_ICON_PATHS['Vers Bottom'] },
  { id: 'bottom', label: 'Bottom', path: POSITION_ICON_PATHS.Bottom },
  { id: 'side', label: 'Side', path: POSITION_ICON_PATHS.Side },
  { id: 'switch', label: 'Switch', path: POSITION_ICON_PATHS.Switch },
] as const;

export type PositionMarkId = (typeof POSITION_MARKS)[number]['id'];

/** Preserve older "versatile" rows and normalise variants entered by clients. */
export function canonicalPositionMark(value: string): PositionMarkId | null {
  const normalized = value.trim().toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ');
  switch (normalized) {
    case 'top': return 'top';
    case 'vers top':
    case 'versatile top': return 'vers_top';
    case 'vers':
    case 'versatile': return 'versatile';
    case 'vers bottom':
    case 'versatile bottom': return 'vers_bottom';
    case 'bottom': return 'bottom';
    case 'side': return 'side';
    case 'switch': return 'switch';
    default: return null;
  }
}

export function positionMarkPath(value: string): string | null {
  const canonical = canonicalPositionMark(value);
  return POSITION_MARKS.find((p) => p.id === canonical)?.path ?? null;
}
