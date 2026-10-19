/**
 * Shared place visuals: inline SVG type glyphs (the same paths as the map pins), the white
 * activity ring, the crowd word and the red "popping" flame. Places are neutral white/gray;
 * red is only the flame.
 */

export const PLACE_GLYPH: Record<string, string> = {
  bar: 'M5 4h14l-7 8zM12 12v7M8 20h8M15.5 7.5h.01',
  club: 'M4 14v4M8 10v8M12 5v13M16 9v9M20 12v6',
  sauna:
    'M8 4c-1.5 1.5-1.5 3 0 4.5s1.5 3 0 4.5M12 4c-1.5 1.5-1.5 3 0 4.5s1.5 3 0 4.5M16 4c-1.5 1.5-1.5 3 0 4.5s1.5 3 0 4.5M4 20h16',
  park: 'M12 3 6.5 11H9l-3 5h12l-3-5h2.5zM12 16v5',
  cafe: 'M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3.5v2.5M12 3.5v2.5',
  gym: 'M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12',
  restaurant: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 0-3 3-3 6v2h3v10M17 3v18',
  beach: 'M3 20h18M12 20v-8M12 12 5 9a7 7 0 0 1 14 0zM12 5v7',
  shop: 'M4 8h16l-1 12H5zM4 8l2-4h12l2 4M9 12a3 3 0 0 0 6 0',
  venue: 'M12 3v12M9 7l3-4 3 4M8 15a4 4 0 1 0 8 0M5 21h14',
  other: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
};
export const FLAME_GLYPH =
  'M12 22c4 0 7-3 7-7 0-3-2-5.5-3.5-7-.2 2-1.3 3.3-2.5 3.8C13.5 8.5 12 5 9 2c.3 3-1.5 5.5-3 7.5A7.9 7.9 0 0 0 5 15c0 4 3 7 7 7z';

/** Rough "full house" headcount per kind, so the ring fills proportionally. */
const CAPACITY: Record<string, number> = {
  bar: 30,
  club: 60,
  sauna: 25,
  park: 20,
  cafe: 15,
  gym: 20,
  restaurant: 25,
  beach: 30,
  shop: 10,
  venue: 80,
  other: 20,
};

export const KIND_LABEL: Record<string, string> = {
  bar: 'Bar',
  club: 'Club',
  cafe: 'Café',
  restaurant: 'Restaurant',
  gym: 'Gym',
  park: 'Park',
  beach: 'Beach',
  sauna: 'Sauna',
  shop: 'Shop',
  venue: 'Venue',
  other: 'Other',
};

export function crowdWord(here: number): 'Chill' | 'Lively' | 'Busy' | 'Packed' {
  if (here >= 20) return 'Packed';
  if (here >= 8) return 'Busy';
  if (here >= 3) return 'Lively';
  return 'Chill';
}

export function ringDegrees(kind: string, here: number, going = 0): number {
  const cap = CAPACITY[kind] ?? 20;
  return Math.max(here || going ? 24 : 0, Math.round(Math.min(1, (here + going * 0.5) / cap) * 360));
}

export function Glyph({ kind, size = 20, className }: { kind: string; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d={PLACE_GLYPH[kind] ?? PLACE_GLYPH.other} />
    </svg>
  );
}

export function Flame({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path d={FLAME_GLYPH} />
    </svg>
  );
}

/** White activity ring + dark glyph disc + headcount badge (+ flame when popping). */
export function PlaceBadge({
  kind,
  here,
  going,
  popping,
  size = 44,
}: {
  kind: string;
  here: number;
  going?: number;
  popping?: boolean;
  size?: number;
}) {
  const deg = ringDegrees(kind, here, going);
  return (
    <span className="relative shrink-0" style={{ width: size, height: size }} aria-hidden>
      {popping && (
        <span className="absolute -left-1.5 -top-1.5 z-[2] flex h-5 w-5 items-center justify-center rounded-chip bg-fg text-danger shadow-[0_0_0_2px_#070707]">
          <Flame />
        </span>
      )}
      <span
        className="absolute inset-0 rounded-chip"
        style={{ background: `conic-gradient(#f5f5f5 ${deg}deg, rgba(255,255,255,0.12) 0)` }}
      />
      <span className="absolute inset-[3px] flex items-center justify-center rounded-chip bg-ink-800 text-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
        <Glyph kind={kind} size={Math.round(size * 0.45)} />
      </span>
      <span className="absolute -right-2 -top-1.5 min-w-5 rounded-chip bg-fg px-1.5 text-center text-[10px] font-bold leading-[18px] text-ink-950 shadow-[0_0_0_2px_#070707]">
        {here}
      </span>
    </span>
  );
}

export const fmtHour = (h: number) => {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric' });
};

export function etaLabel(etaAt: string | null | undefined): string {
  if (!etaAt) return '';
  const m = Math.round((new Date(etaAt).getTime() - Date.now()) / 60_000);
  if (m <= 0) return 'arriving now';
  return m < 60 ? `arrives in ${m}m` : `arrives in ${Math.round(m / 60)}h`;
}
