/** Help, safety, privacy and legal sections shown in the public Legal Center. */
export const HELP_SECTIONS = {
  help: { group: 'Help', title: 'Help center', blurb: 'Searchable FAQ.' },
  support: { group: 'Help', title: 'Talk to a person', blurb: 'Human support and escalation.' },
  appeals: { group: 'Help', title: 'Account standing & appeals', blurb: 'Moderation status and appeal intake.' },
  report: { group: 'Help', title: 'Report or request removal', blurb: 'Public safety and removal intake.' },

  terms: { group: 'Legal', title: 'Terms of Service', blurb: 'Rules for using PIROKA.' },
  billing: { group: 'Legal', title: 'Subscription & Billing Terms', blurb: 'Recurring billing, cancellation and refunds.' },
  dmca: { group: 'Legal', title: 'Copyright / DMCA Policy', blurb: 'Copyright notices and counter-notices.' },
  'legal-requests': { group: 'Legal', title: 'Legal & Law-Enforcement Requests', blurb: 'Government, emergency and civil legal process.' },
  '2257': { group: 'Legal', title: '18 U.S.C. §§ 2257 / 2257A Notice', blurb: 'User-generated adult-content recordkeeping notice.' },

  privacy: { group: 'Privacy & Data', title: 'Privacy Policy', blurb: 'What PIROKA collects, uses and discloses.' },
  california: { group: 'Privacy & Data', title: 'California Privacy Notice', blurb: 'California-specific privacy disclosures.' },
  location: { group: 'Privacy & Data', title: 'Location Privacy & Safety', blurb: 'How location is processed and obscured.' },
  deletion: { group: 'Privacy & Data', title: 'Account Deletion & Data Rights', blurb: 'Delete, access, correct and export data.' },
  cookies: { group: 'Privacy & Data', title: 'Cookie & Tracking Notice', blurb: 'Cookies, storage, analytics and preference signals.' },
  retention: { group: 'Privacy & Data', title: 'Data Retention Policy', blurb: 'Retention targets and legal holds.' },
  automation: { group: 'Privacy & Data', title: 'Automated Moderation Disclosure', blurb: 'Automated safety and abuse-detection systems.' },

  guidelines: { group: 'Safety & Content', title: 'Community Guidelines', blurb: 'Community behavior rules.' },
  aup: { group: 'Safety & Content', title: 'Acceptable Use Policy', blurb: 'Prohibited use and abuse.' },
  content: { group: 'Safety & Content', title: 'Content Policy', blurb: 'Public vs. private adult content rules.' },
  safety: { group: 'Safety & Content', title: 'Safety Center', blurb: 'Meeting, privacy and harm-reduction guidance.' },
  removal: { group: 'Safety & Content', title: 'Content Removal Policy', blurb: 'How removal requests are reviewed.' },
  'appeals-policy': { group: 'Safety & Content', title: 'Appeals Policy', blurb: 'How enforcement decisions can be challenged.' },
  ncii: { group: 'Safety & Content', title: 'NCII / Intimate Image Removal', blurb: 'Non-consensual intimate image removal.' },
  minors: { group: 'Safety & Content', title: 'Minor & CSAM Safety Policy', blurb: '18+ enforcement and child-safety escalation.' },
  trafficking: { group: 'Safety & Content', title: 'Exploitation & Commercial Sex Policy', blurb: 'No prostitution, trafficking or sexual exploitation.' },
} as const;

export type HelpSlug = keyof typeof HELP_SECTIONS;

export const HELP_GROUPS = ['Help', 'Legal', 'Privacy & Data', 'Safety & Content'] as const;

export const HELP_SLUGS: HelpSlug[] = [
  'help',
  'support',
  'appeals',
  'report',
  'terms',
  'billing',
  'dmca',
  'legal-requests',
  '2257',
  'privacy',
  'california',
  'location',
  'deletion',
  'cookies',
  'retention',
  'automation',
  'guidelines',
  'aup',
  'content',
  'safety',
  'removal',
  'appeals-policy',
  'ncii',
  'minors',
  'trafficking',
];

export const isHelpSlug = (s: string): s is HelpSlug => s in HELP_SECTIONS;
