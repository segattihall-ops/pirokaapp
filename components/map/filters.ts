import type { NearbyPerson } from '@/app/api/nearby/route';
import { INTENTS, type IntentChip } from '@/lib/intent';
import { POSITION_MARKS, canonicalPositionMark } from '@/lib/design/icon-paths';

/**
 * The Filter sheet model (prototype: "Describe who you're looking for" + chip groups). Every option maps onto
 * a self-described profile field the nearby API exposes, so filtering stays truthful to real data.
 */
export type FilterKey = 'show' | 'position' | 'body' | 'identity' | 'ethnicity' | 'orientation' | 'looking';
export type Filters = Record<FilterKey, string[]>;

export const EMPTY_FILTERS: Filters = {
  show: [],
  position: [],
  body: [],
  identity: [],
  ethnicity: [],
  orientation: [],
  looking: [],
};

export const FILTER_OPTIONS: Record<FilterKey, string[]> = {
  show: ['Men', 'Women', 'Trans women', 'Trans men', 'Non-binary people'],
  position: POSITION_MARKS.map((p) => p.label),
  body: ['Bear', 'Cub', 'Otter', 'Jock', 'Twink', 'Chubby', 'Daddy'],
  identity: ['Cis', 'Trans', 'Non-binary', 'Queer', 'Gender fluid'],
  ethnicity: [
    'Asian',
    'Black',
    'Latinx',
    'Middle Eastern',
    'Mixed',
    'Native / Indigenous',
    'Pacific Islander',
    'South Asian',
    'White',
    'Other',
  ],
  orientation: ['Gay', 'Lesbian', 'Bisexual', 'Pansexual', 'Queer'],
  looking: ['Discreet', 'Newcomer', 'Sober', 'Kink-friendly', 'Polyamorous'],
};

export const FILTER_GROUPS: { key: FilterKey; title: string }[] = [
  { key: 'show', title: 'Show me' },
  { key: 'position', title: 'Position' },
  { key: 'body', title: 'Body type' },
  { key: 'identity', title: 'Gender identity' },
  { key: 'ethnicity', title: 'Ethnicity' },
  { key: 'orientation', title: 'Orientation' },
  { key: 'looking', title: 'Looking for' },
];

/** Position marks: the profile stores top / versatile / bottom; the pin draws the prototype glyph for each. */
export const POSITION_GLYPH: Record<string, string> = Object.fromEntries(
  POSITION_MARKS.flatMap((p) => [[p.id, p.path], [p.label, p.path]]),
);
export const POSITION_LABEL: Record<string, string> = Object.fromEntries(
  POSITION_MARKS.map((p) => [p.id, p.label]),
);
const POSITION_OF_OPTION: Record<string, string> = Object.fromEntries(
  POSITION_MARKS.map((p) => [p.label, p.id]),
);

const TRANS_WORDS = ['trans', 'transmasculine', 'transfeminine'];
const NB_WORDS = [
  'non-binary',
  'genderqueer',
  'genderfluid',
  'agender',
  'bigender',
  'demiboy',
  'demigirl',
  'two-spirit',
  'androgynous',
];
const lower = (xs: string[]) => xs.map((x) => x.toLowerCase());
const hasWord = (xs: string[], words: string[]) => xs.some((x) => words.some((w) => x.includes(w)));

/** "Show me" buckets derived from the self-described gender list. */
function showBuckets(gender: string[]): Set<string> {
  const g = lower(gender);
  const out = new Set<string>();
  const trans = hasWord(g, TRANS_WORDS);
  if (g.some((x) => x === 'man' || x === 'trans man' || x === 'transmasculine' || x === 'demiboy'))
    out.add('Men');
  if (g.some((x) => x === 'woman' || x === 'trans woman' || x === 'transfeminine' || x === 'demigirl'))
    out.add('Women');
  if (g.some((x) => x === 'trans woman' || x === 'transfeminine')) out.add('Trans women');
  if (g.some((x) => x === 'trans man' || x === 'transmasculine')) out.add('Trans men');
  if (hasWord(g, NB_WORDS) || (trans && !out.size)) out.add('Non-binary people');
  return out;
}

function identityBuckets(gender: string[], communities: string[]): Set<string> {
  const g = lower(gender);
  const c = lower(communities);
  const out = new Set<string>();
  if (hasWord(g, TRANS_WORDS)) out.add('Trans');
  if (hasWord(g, NB_WORDS)) out.add('Non-binary');
  if (g.includes('genderfluid')) out.add('Gender fluid');
  if (g.includes('queer') || c.some((x) => x.includes('queer'))) out.add('Queer');
  if (!out.has('Trans') && !out.has('Non-binary') && g.length) out.add('Cis');
  return out;
}

export function matchesFilters(p: NearbyPerson, f: Filters): boolean {
  const a = p.attrs;
  if (f.show.length && !f.show.some((s) => showBuckets(a.gender).has(s))) return false;
  if (f.position.length && !f.position.some((o) => a.position.some((mark) => canonicalPositionMark(mark) === POSITION_OF_OPTION[o]))) return false;
  if (f.body.length && !f.body.some((o) => lower(a.communities).includes(o.toLowerCase()))) return false;
  if (f.identity.length && !f.identity.some((o) => identityBuckets(a.gender, a.communities).has(o)))
    return false;
  if (f.ethnicity.length && !f.ethnicity.some((o) => lower(a.ethnicity).includes(o.toLowerCase())))
    return false;
  if (f.orientation.length && !f.orientation.some((o) => lower(a.orientation).includes(o.toLowerCase())))
    return false;
  if (f.looking.length && !f.looking.some((o) => lower(a.communities).includes(o.toLowerCase())))
    return false;
  return true;
}

export const activeFilterCount = (f: Filters) => FILTER_GROUPS.reduce((n, g) => n + f[g.key].length, 0);

export type SmartResult = { filters: Filters; chip: IntentChip | null; note: string };

/**
 * Turns "vers guys hosting tonight, athletic, within a mile" into filters + an intent chip. A pure port of the
 * prototype's fallback parser so it works with no AI key and never leaves the browser.
 */
export function parseSmartQuery(text: string): SmartResult {
  const q = text.toLowerCase().trim();
  const f: Filters = {
    ...EMPTY_FILTERS,
    show: [],
    position: [],
    body: [],
    identity: [],
    ethnicity: [],
    orientation: [],
    looking: [],
  };
  const parts: string[] = [];
  let chip: IntentChip | null = null;
  const add = (k: FilterKey, v: string) => {
    if (!f[k].includes(v)) {
      f[k].push(v);
      parts.push(v);
    }
  };
  const rules: [RegExp, FilterKey, string][] = [
    [/\b(guys?|men|dudes?|boys?)\b/, 'show', 'Men'],
    [/\b(women|girls?|ladies|lesbians?)\b/, 'show', 'Women'],
    [/\btrans (women|girls?)\b/, 'show', 'Trans women'],
    [/\btrans (men|guys?)\b/, 'show', 'Trans men'],
    [/\b(enby|enbies|non-?binary)\b/, 'show', 'Non-binary people'],
    [/\btops?\b/, 'position', 'Top'],
    [/\bbottoms?\b/, 'position', 'Bottom'],
    [/\bvers(atile)?\b/, 'position', 'Vers'],
    [/\bbears?\b/, 'body', 'Bear'],
    [/\bcubs?\b/, 'body', 'Cub'],
    [/\botters?\b/, 'body', 'Otter'],
    [/\b(jocks?|athletic|muscul|gym)\b/, 'body', 'Jock'],
    [/\btwinks?\b/, 'body', 'Twink'],
    [/\b(chub|chubby|husky)\b/, 'body', 'Chubby'],
    [/\bdadd(y|ies)\b/, 'body', 'Daddy'],
    [/\btrans\b(?!\s*(women|girls?|men|guys?))/, 'identity', 'Trans'],
    [/\bgender ?fluid\b/, 'identity', 'Gender fluid'],
    [/\blesbians?\b/, 'orientation', 'Lesbian'],
    [/\b(bi|bisexual)\b/, 'orientation', 'Bisexual'],
    [/\bpan(sexual)?\b/, 'orientation', 'Pansexual'],
    [/\bgay\b/, 'orientation', 'Gay'],
    [/\bdiscreet\b/, 'looking', 'Discreet'],
    [/\b(new in town|newcomers?|just moved)\b/, 'looking', 'Newcomer'],
    [/\bsober\b/, 'looking', 'Sober'],
    [/\bkink/, 'looking', 'Kink-friendly'],
    [/\bpoly/, 'looking', 'Polyamorous'],
  ];
  for (const [re, k, v] of rules) if (re.test(q)) add(k, v);
  if (/\bhost/.test(q)) chip = 'hosting';
  else if (/\b(tonight|later|this evening)\b/.test(q)) chip = 'tonight';
  else if (/\b(visit|travel+ing|tourist|in town)\b/.test(q)) chip = 'visitors';
  else if (/\b(now|right now|online|available|ready)\b/.test(q)) chip = 'now';
  if (chip)
    parts.push(
      chip === 'visitors'
        ? 'Visitors'
        : chip === 'now'
          ? INTENTS.now.label
          : chip === 'hosting'
            ? 'Hosting'
            : 'Tonight',
    );
  return {
    filters: f,
    chip,
    note: parts.length
      ? `Applied: ${parts.join(' · ')}`
      : 'Try position, body type, identity, or “hosting / tonight / now”.',
  };
}
