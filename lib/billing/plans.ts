/**
 * Plan catalog — the one place the plan names, prices and feature lists live (FEATURES.md §10).
 * Client-safe: no server imports.
 */
export type PaidPlan = 'plus' | 'premium';
export type PlanKey = 'free' | PaidPlan;

export const PLAN_PRICE_USD: Record<PaidPlan, number> = { plus: 5, premium: 10 };

export const PLAN_CATALOG: {
  key: PlanKey;
  name: string;
  mark: '' | '✚' | '★';
  price: string;
  tagline: string;
  features: string[];
}[] = [
  {
    key: 'free',
    name: 'Free',
    mark: '',
    price: '$0',
    tagline: 'Core features are free forever.',
    features: ['Live map and chat', 'Filters', 'Communities and events', 'SafeMeet', '2 album photos'],
  },
  {
    key: 'plus',
    name: 'Plus',
    mark: '✚',
    price: '$5/mo',
    tagline: 'Explore anywhere, keep everything.',
    features: ['60+ identity filters', 'Saved trips', 'Unlimited history', '5 album photos'],
  },
  {
    key: 'premium',
    name: 'Premium',
    mark: '★',
    price: '$10/mo',
    tagline: 'Everything in Plus, and it learns your type.',
    features: [
      'Your type and match scores',
      'Desperate alerts',
      'Favorite online alerts',
      'Who viewed or liked you',
      'Priority support',
    ],
  },
];

export const planLabel = (p: string | null | undefined) =>
  p === 'premium' ? 'Premium' : p === 'plus' ? 'Plus' : p === 'anonymous' ? 'Anonymous' : 'Free';

export const isPaid = (p: string | null | undefined): p is PaidPlan => p === 'plus' || p === 'premium';

export const fmtDay = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';
