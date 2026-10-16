/** Premium "Desperate" alert rules, shared by the API route and the map client. */
export const DESPERATE_MINUTES = 30;
export const DESPERATE_COOLDOWN_H = 3;

export type DesperateState = {
  /** Premium members can send; everyone can see the current alert and cooldown. */
  allowed: boolean;
  active: { until: string; reached: number } | null;
  /** Earliest time the next alert may go out, or null when one may be sent right away. */
  nextAt: string | null;
};
