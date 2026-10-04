export const ACTIVE_PRESENCE_MS = 15 * 60_000;
export const RECENT_PRESENCE_MS = 60 * 60_000;

// Presence is cheaper than recapturing coordinates and never changes location data.
export const PRESENCE_HEARTBEAT_MS = 5 * 60_000;

// Re-capture at lower frequency so an "active" pin never relies on a coordinate older
// than the active window. The server still exposes only the privacy-fuzzed public_geo.
export const LOCATION_REFRESH_MS = 10 * 60_000;

export type PresenceActivity = 'active' | 'recent' | 'today';

export function presenceActivity(
  presenceAt: string | null | undefined,
  now = Date.now(),
): PresenceActivity {
  const seenAt = presenceAt ? new Date(presenceAt).getTime() : Number.NaN;
  const age = now - seenAt;
  if (Number.isFinite(seenAt) && age <= ACTIVE_PRESENCE_MS) return 'active';
  if (Number.isFinite(seenAt) && age <= RECENT_PRESENCE_MS) return 'recent';
  return 'today';
}
