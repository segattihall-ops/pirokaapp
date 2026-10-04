/** Shared pick-lists for onboarding and profile editing. Free text is never accepted for these fields. */
export const PRONOUNS = ['he/him', 'she/her', 'they/them', 'he/they', 'she/they', 'any pronouns', 'ask me'];
export const GENDER = [
  'Man',
  'Woman',
  'Trans man',
  'Trans woman',
  'Non-binary',
  'Genderqueer',
  'Genderfluid',
  'Agender',
  'Bigender',
  'Demiboy',
  'Demigirl',
  'Two-Spirit',
  'Intersex',
  'Transmasculine',
  'Transfeminine',
  'Questioning',
  'Butch',
  'Femme',
  'Masc',
  'Androgynous',
];
export const ORIENT = [
  'Gay',
  'Lesbian',
  'Bisexual',
  'Pansexual',
  'Queer',
  'Asexual',
  'Demisexual',
  'Greysexual',
  'Omnisexual',
  'Polysexual',
  'Heteroflexible',
  'Homoflexible',
  'Sapphic',
  'Achillean',
  'Questioning',
  'Straight but curious',
];
export const COMM = [
  'Bear',
  'Cub',
  'Otter',
  'Wolf',
  'Twink',
  'Jock',
  'Daddy',
  'Leather',
  'Drag',
  'Stud',
  'Soft butch',
  'Lipstick',
  'Chubby',
  'Chaser',
  'Geek',
  'Rugged',
  'Poz',
  'Sober',
  'Discreet',
  'Clean-cut',
  'Punk',
  'Latinx',
  'Black & queer',
  'Asian & queer',
  'Deaf',
  'Disabled',
  'Neurodivergent',
  'Polyamorous',
  'Kink-friendly',
  'Newcomer',
];
export const SHOW_ME: [string, string][] = [
  ['Men', 'Cis & trans'],
  ['Women', 'Cis & trans'],
  ['Trans women', 'Only'],
  ['Trans men', 'Only'],
  ['Non-binary people', 'All NB identities'],
  ['Everyone', 'Show me all'],
];
export const VIS_OPTS: [string, string][] = [
  ['Neighborhood', '~0.3 mi fuzz'],
  ['Area', '~1 mi fuzz'],
  ['Hidden', 'Not on map'],
];
export const ICONS: [string, string, string, string][] = [
  ['πroka', 'π', 'bg-ink-900', 'text-fg'],
  ['Calculator', '±', 'bg-amber-600', 'text-ink-950'],
  ['Weather', '☀', 'bg-blue-500', 'text-white'],
  ['Notes', '≡', 'bg-yellow-300', 'text-ink-800'],
];

export const HANDLE_RE = /^[\w.-]{2,24}$/;

/** Photo slots per plan: main + album. */
export const PHOTO_LIMIT: Record<string, number> = { anonymous: 6, free: 3, plus: 6, premium: 6 };

/**
 * Plan used for feature limits. While πroka is in testing, anonymous members get every tier's
 * limits so the whole product can be exercised without a subscription.
 */
export const effectivePlan = (plan: string | null | undefined, authProvider?: string | null) =>
  authProvider === 'anonymous' ? 'premium' : (plan ?? 'free');
export const photoLimit = (plan: string | null | undefined, authProvider?: string | null) =>
  PHOTO_LIMIT[effectivePlan(plan, authProvider)] ?? 3;
