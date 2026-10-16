/** Growth banners shown on the map, frequency-capped client-side (prototype: none in the first session). */
export type Promo = {
  id: string;
  title: string;
  sub: string;
  cta: string;
  d: string;
  plan?: 'plus' | 'premium';
  go?: 'testing';
};

export const PROMOS: Promo[] = [
  {
    id: 'type',
    title: 'Meet your type faster',
    sub: 'πroka learns what you like and scores everyone nearby.',
    cta: 'See Premium',
    plan: 'premium',
    d: 'M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z',
  },
  {
    id: 'quickexit',
    title: 'Tip: Quick exit',
    sub: 'Press Esc twice to show a decoy screen instantly.',
    cta: 'Got it',
    d: 'M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3zM9.5 9.5l5 5M14.5 9.5l-5 5',
  },
  {
    id: 'favalert',
    title: 'Know when favorites are online',
    sub: 'Get an alert the moment someone you starred comes online.',
    cta: 'See Premium',
    plan: 'premium',
    d: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  },
  {
    id: 'testing',
    title: 'New: free testing near you',
    sub: 'Places → Testing lists free HIV and STI clinics with directions.',
    cta: 'Open',
    go: 'testing',
    d: 'M12 3 4.5 6v6c0 4.3 3.2 8.2 7.5 9 4.3-.8 7.5-4.7 7.5-9V6zM12 9v6M9 12h6',
  },
  {
    id: 'trips',
    title: 'Travel with a head start',
    sub: 'Save trips so locals can say hi before you land.',
    cta: 'See Plus',
    plan: 'plus',
    d: 'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z',
  },
];

/** Free/anonymous members may see more banners; Plus/Premium fewer, and plan-gated ones are hidden on that plan. */
export function promosFor(plan: string): Promo[] {
  const free = plan === 'free' || plan === 'anonymous';
  return PROMOS.filter((p) => (free ? true : !p.plan) && p.plan !== plan);
}
