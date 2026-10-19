/**
 * Launch all-access.
 *
 * While this is open, every member — free, anonymous, or paid — gets every paid feature, no
 * subscription required. It only affects FEATURE and LIMIT checks; it never touches billing records
 * (a free member stays "Free" on the billing screen and still sees upgrade CTAs), so whenever we
 * close it everyone simply reverts to the plan they actually hold.
 *
 * It is currently OPEN-ENDED ("premium for everyone, for now"): it stays on until we turn it off.
 * To end it, set OPEN_ENDED to false — access then follows LAUNCH_ALL_ACCESS_UNTIL (set that to a
 * past date to switch it off entirely, or a future date to time-box it again).
 */
const OPEN_ENDED = true;
export const LAUNCH_ALL_ACCESS_UNTIL = Date.parse('2026-10-27T05:00:00.000Z');

/** True while all-access is open. */
export function launchAllAccess(now: number = Date.now()): boolean {
  if (OPEN_ENDED) return true;
  return Number.isFinite(LAUNCH_ALL_ACCESS_UNTIL) && now < LAUNCH_ALL_ACCESS_UNTIL;
}

/** ISO instant access closes, or null when it is open-ended or not open. */
export function launchAllAccessUntil(now: number = Date.now()): string | null {
  if (OPEN_ENDED) return null;
  return launchAllAccess(now) ? new Date(LAUNCH_ALL_ACCESS_UNTIL).toISOString() : null;
}

/**
 * The plan a member effectively has for feature/limit checks right now. During the launch window
 * everyone is promoted to 'premium'; otherwise the stored plan is returned (unknown → 'free').
 * Use this for gating, never for billing writes.
 */
export function effectivePlanNow(
  plan: string | null | undefined,
  now: number = Date.now(),
): 'free' | 'plus' | 'premium' {
  if (launchAllAccess(now)) return 'premium';
  const p = plan ?? 'free';
  return p === 'plus' || p === 'premium' ? p : 'free';
}
