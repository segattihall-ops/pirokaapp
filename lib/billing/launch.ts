/**
 * Launch all-access window.
 *
 * For the first days after launch, every member — free, anonymous, or paid — gets every paid
 * feature, no subscription required. This only affects FEATURE and LIMIT checks; it never touches
 * billing records (a free member stays "Free" on the billing screen and still sees upgrade CTAs),
 * so when the window closes everyone simply reverts to the plan they actually hold.
 *
 * To change or end the promo, move this timestamp (or set it to a past date to switch the window off).
 */
// 7 days from launch on 2026-10-19: open through the end of 2026-10-26 in US Central (the app's home
// region), i.e. 2026-10-27 05:00 UTC, so no one in the primary audience is cut off early.
export const LAUNCH_ALL_ACCESS_UNTIL = Date.parse('2026-10-27T05:00:00.000Z');

/** True while the launch all-access window is open. */
export function launchAllAccess(now: number = Date.now()): boolean {
  return Number.isFinite(LAUNCH_ALL_ACCESS_UNTIL) && now < LAUNCH_ALL_ACCESS_UNTIL;
}

/** ISO instant the window closes, or null when it is not open. */
export function launchAllAccessUntil(now: number = Date.now()): string | null {
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
