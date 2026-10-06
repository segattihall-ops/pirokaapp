import type { Plan } from './paypal';

export type Feature =
  | 'safemeet'
  | 'pulse'
  | 'advanced_filters'
  | 'priority_support'
  | 'unlimited_favorites'
  | 'custom_status'
  | 'travel_mode';

export const FEATURE_TIERS: Record<Feature, Set<Plan>> = {
  safemeet: new Set(['plus', 'premium']),
  pulse: new Set(['premium']),
  advanced_filters: new Set(['plus', 'premium']),
  priority_support: new Set(['premium']),
  unlimited_favorites: new Set(['plus', 'premium']),
  custom_status: new Set(['plus', 'premium']),
  travel_mode: new Set(['free', 'plus', 'premium']), // Free feature now
};

export function hasFeature(plan: Plan, feature: Feature): boolean {
  return FEATURE_TIERS[feature]?.has(plan) ?? false;
}

export const PLAN_FEATURES: Record<Plan, Feature[]> = {
  free: ['travel_mode'],
  plus: [
    'safemeet',
    'advanced_filters',
    'unlimited_favorites',
    'custom_status',
    'travel_mode',
  ],
  premium: [
    'safemeet',
    'pulse',
    'advanced_filters',
    'priority_support',
    'unlimited_favorites',
    'custom_status',
    'travel_mode',
  ],
};

export const PLAN_NAMES: Record<Plan, string> = {
  free: 'Free',
  plus: 'πroka Plus',
  premium: 'πroka Premium',
};

export const PLAN_PRICES: Record<Exclude<Plan, 'free'>, { monthly: number; yearly: number }> = {
  plus: { monthly: 9.99, yearly: 79.99 },
  premium: { monthly: 19.99, yearly: 159.99 },
};

export const PLAN_DESCRIPTIONS: Record<Plan, string> = {
  free: 'Core features for safe discovery',
  plus: 'SafeMeet + advanced filters + priority support coming soon',
  premium: 'Everything + Pulse analytics + priority support',
};
