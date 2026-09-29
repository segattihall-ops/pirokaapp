/** Help & Legal sections. Mirrors the hash routes in design_handoff/design/Piroka Help.dc.html. */
export const HELP_SECTIONS = {
  help: { group: 'Help', title: 'Help center', blurb: 'Searchable FAQ.' },
  support: {
    group: 'Help',
    title: 'Talk to a person',
    blurb: 'Human support in PT and EN. SLA under 24h, Premium under 4h.',
  },
  appeals: { group: 'Help', title: 'Account standing', blurb: 'Status, the moderation ladder and appeals.' },
  report: { group: 'Help', title: 'Report content', blurb: 'Works without an account.' },
  guidelines: { group: 'Policies', title: 'Community Guidelines', blurb: 'What we remove and why.' },
  safety: { group: 'Policies', title: 'Safety Center', blurb: 'Meeting safely, SafeMeet, harm reduction.' },
  terms: {
    group: 'Policies',
    title: 'Terms of Service',
    blurb: 'Draft — counsel must review before launch.',
    draft: true,
  },
  privacy: {
    group: 'Policies',
    title: 'Privacy Policy',
    blurb: 'Draft — counsel must review before launch.',
    draft: true,
  },
  '2257': {
    group: 'Policies',
    title: '18 U.S.C. § 2257',
    blurb: 'Draft — custodian of records details pending.',
    draft: true,
  },
} as const;

export type HelpSlug = keyof typeof HELP_SECTIONS;
// Explicit order: Object.keys would hoist the numeric '2257' key to the front.
export const HELP_SLUGS: HelpSlug[] = [
  'help',
  'support',
  'appeals',
  'report',
  'guidelines',
  'safety',
  'terms',
  'privacy',
  '2257',
];
export const isHelpSlug = (s: string): s is HelpSlug => s in HELP_SECTIONS;
