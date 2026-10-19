/**
 * Conservative drug-sale / chemsex-arrangement detector for public surfaces (local board, place and
 * group chat). The product rule: harm-reduction content only — never selling, sourcing or arranging.
 * Deliberately small and word-bounded so everyday words ("party", "ice cream", "plug in") never
 * trip it; the moderation queue catches the rest.
 */
const TERMS = [
  'tina',
  'crystal meth',
  'meth',
  'pnp',
  'party and play',
  'party n play',
  'chems',
  'chemsex',
  'ghb',
  'gbl',
  'slamming',
  'molly',
  'mdma',
  'ketamine',
  'cocaine',
  'dealer',
  'capital t',
  '(got|have|need|want|selling|sell|buy|buying)\\s+(some\\s+)?t',
  't\\s+for\\s+sale',
  'drugs?\\s+for\\s+sale',
  'sell(ing)?\\s+(drugs|pills|molly|ghb|meth)',
];

const RE = new RegExp(`(^|[^a-z0-9])(${TERMS.join('|')})(?=$|[^a-z0-9])`, 'i');

/** True when the text reads like it sells, sources or arranges drugs. */
export function hasDrugTerms(text: string): boolean {
  return RE.test(text.normalize('NFKD').replace(/[̀-ͯ]/g, ''));
}

export const DRUG_TERMS_MESSAGE =
  'πroka is drug-free: posts that sell, source or arrange drugs are blocked. Harm-reduction help is in Safety.';
