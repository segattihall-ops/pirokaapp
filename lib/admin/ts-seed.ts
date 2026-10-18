/**
 * Seeded Trust & Safety data for the admin console, ported from the Piroka Admin prototype
 * (design_handoff → Piroka_Admin.dc.html). Used for the queues that do not yet have a backend
 * (Appeals, Verifications, Support, Ambassadors, Places & testing, Risk regions). The Reports and
 * Users tabs read real data from /api/admin/*; everything seeded here is clearly labelled "Demo data"
 * in the UI so no one mistakes it for live moderation state. Nothing here is persisted.
 */

export const RULES = [
  'Guidelines → Consent first',
  'Guidelines → Adults only',
  'Guidelines → No hate',
  'Guidelines → Be real',
  'Guidelines → Meet safely',
  'Terms → Paid plans',
  'Terms → Content',
] as const;

export const REASONS = [
  'Harassment',
  'Fake or impersonation',
  'Scam or spam',
  'Hate or discrimination',
  'Shared my photos',
  'Underage',
  'Threats or violence',
] as const;

export const SEV: Record<string, 1 | 2 | 3> = {
  Underage: 3,
  'Threats or violence': 3,
  'Shared my photos': 3,
  Harassment: 2,
  'Hate or discrimination': 2,
  'Fake or impersonation': 1,
  'Scam or spam': 1,
};

const H = [
  'NightOwl',
  'Curious_32',
  'DiscreetDad',
  'GymRat',
  'Otter.co',
  'QuietStorm',
  'BearHug',
  'Vers4Now',
  'Midtown_M',
  'TallGuy',
  'Sk8rBoi',
  'SilverFox',
  'Plaid',
  'CoffeeFirst',
  'Nomad',
  'Rooftop',
];

export const RISK_COUNTRIES = [
  'Saudi Arabia',
  'Iran',
  'Afghanistan',
  'Pakistan',
  'Nigeria',
  'Uganda',
  'Qatar',
  'United Arab Emirates',
  'Egypt',
  'Malaysia',
  'Brunei',
  'Yemen',
  'Somalia',
  'Russia',
  'Ghana',
  'Kenya',
  'Mauritania',
  'Sudan',
  'Libya',
  'Iraq',
  'Kuwait',
  'Oman',
  'Tanzania',
  'Indonesia',
  'Turkey',
  'Poland',
];

export type SeedReport = {
  id: string;
  reason: string;
  target: string;
  reporter: string;
  age: number;
  sev: 1 | 2 | 3;
  details: string;
  evidence: boolean;
  priors: string[];
  status: string;
};
export type SeedAppeal = {
  id: string;
  user: string;
  action: string;
  rule: string;
  by: string;
  age: number;
  text: string;
  status: string;
};
export type SeedVerif = {
  id: string;
  user: string;
  kind: string;
  age: number;
  detail: string;
  status: string;
};
export type SeedTicket = {
  id: string;
  user: string;
  topic: string;
  lang: string;
  age: number;
  msg: string;
  prem: boolean;
  status: string;
};
export type SeedAmbassador = {
  id: string;
  user: string;
  city: string;
  hours: string;
  why: string;
  status: string;
  actions: number;
  agree: number;
};
export type SeedSite = { id: string; name: string; zip: string; verified: boolean; status: string };
export type SeedAudit = { m: number; who: string; what: string };

const detailFor = (i: number) =>
  [
    'Kept messaging after I said no.',
    'Photos are from an Instagram account that isn’t theirs.',
    'Asked me to pay a “deposit” before meeting.',
    'Profile says “no Asians”.',
    'Posted my album photo in a group chat.',
    'Profile says 18 but mentions high school.',
    'Said he knows where I live.',
  ][(i * 3) % 7];

/** Seeded queues are a design aid; a production console must never mix invented cases with real ones. */
export const SEEDS_ENABLED = process.env.NODE_ENV !== 'production';

export function seedReports(): SeedReport[] {
  if (!SEEDS_ENABLED) return [];
  return Array.from({ length: 11 }, (_, i): SeedReport => {
    const reason = REASONS[(i * 3) % REASONS.length];
    return {
      id: 'TS-' + (41200 + i * 37),
      reason,
      target: H[(i * 5 + 1) % H.length],
      reporter: H[(i * 7 + 3) % H.length],
      age: 5 + i * 41,
      sev: SEV[reason],
      details: detailFor(i),
      evidence: i % 3 !== 2,
      priors: i % 4 === 0 ? ['Warning · Aug 2 · Guidelines → Consent first'] : [],
      status: i > 8 ? 'actioned' : 'open',
    };
  });
}

export function seedAppeals(): SeedAppeal[] {
  if (!SEEDS_ENABLED) return [];
  return [
    {
      id: 'AP-2093',
      user: 'Plaid',
      action: 'PR-20931 · Warning',
      rule: 'Guidelines → No hate',
      by: 'Rafa (T&S)',
      age: 180,
      text: 'I removed the line from my bio. I didn’t realize it was hurtful — it won’t happen again.',
      status: 'open',
    },
    {
      id: 'AP-2101',
      user: 'Nomad',
      action: 'PR-21077 · Suspended 7 days',
      rule: 'Guidelines → Be real',
      by: 'Jordan (T&S)',
      age: 95,
      text: 'These are my real photos. I can verify with a selfie.',
      status: 'open',
    },
    {
      id: 'AP-2107',
      user: 'TallGuy',
      action: 'PR-21102 · Limited 24h',
      rule: 'Guidelines → Consent first',
      by: 'Kai (Admin)',
      age: 30,
      text: 'We were joking with each other, the other person reported by mistake.',
      status: 'open',
    },
  ];
}

export function seedVerifs(): SeedVerif[] {
  if (!SEEDS_ENABLED) return [];
  return [
    {
      id: 'VR-8801',
      user: 'Otter.co',
      kind: 'Photo',
      age: 12,
      detail: 'Pose “Thumbs up” · face match score 0.94',
      status: 'open',
    },
    {
      id: 'VR-8802',
      user: 'Midtown_M',
      kind: 'Health document',
      age: 40,
      detail: 'AI could not confirm: image blurry. Extracted: none.',
      status: 'open',
    },
    {
      id: 'VR-8803',
      user: 'BearHug',
      kind: 'Age (ID fallback)',
      age: 65,
      detail: 'Driver license · DOB passes 18+ · face match 0.88',
      status: 'open',
    },
    {
      id: 'VR-8804',
      user: 'Rooftop',
      kind: 'Photo',
      age: 130,
      detail: 'Pose “Look to your left” · face match score 0.61',
      status: 'open',
    },
  ];
}

export function seedTickets(): SeedTicket[] {
  if (!SEEDS_ENABLED) return [];
  return [
    {
      id: 'SP-5520',
      user: 'Curious_32',
      topic: 'My account was hacked',
      lang: 'PT',
      age: 22,
      msg: 'Alguém entrou na minha conta e mudou minha foto.',
      prem: false,
      status: 'open',
    },
    {
      id: 'SP-5521',
      user: 'SilverFox',
      topic: 'Billing question',
      lang: 'EN',
      age: 190,
      msg: 'I was charged twice for Plus this month.',
      prem: true,
      status: 'open',
    },
    {
      id: 'SP-5522',
      user: 'GymRat',
      topic: 'Someone is harassing me',
      lang: 'EN',
      age: 8,
      msg: 'Blocked him but he made a new account and found me again.',
      prem: false,
      status: 'open',
    },
    {
      id: 'SP-5523',
      user: 'CoffeeFirst',
      topic: 'Location question',
      lang: 'ES',
      age: 300,
      msg: '¿Otros pueden ver mi ubicación exacta?',
      prem: false,
      status: 'open',
    },
  ];
}

export function seedAmbassadors(): SeedAmbassador[] {
  if (!SEEDS_ENABLED) return [];
  return (
    [
      [
        'AM-71',
        'BearHug',
        'Dallas',
        '2–4h',
        'Ran the Oak Lawn Pride welcome table for 3 years. EN/ES.',
        'open',
        0,
        0,
      ],
      [
        'AM-72',
        'CoffeeFirst',
        'Dallas',
        '1–2h',
        'Nurse, happy to answer health questions and point people to testing.',
        'open',
        0,
        0,
      ],
      ['AM-60', 'SilverFox', 'Dallas', '5h+', 'Active since launch.', 'active', 142, 96],
      ['AM-61', 'Otter.co', 'Austin', '2–4h', 'Active since June.', 'active', 58, 91],
    ] as [string, string, string, string, string, string, number, number][]
  ).map(([id, user, city, hours, why, status, actions, agree]) => ({
    id,
    user,
    city,
    hours,
    why,
    status,
    actions,
    agree,
  }));
}

export function seedSites(): SeedSite[] {
  if (!SEEDS_ENABLED) return [];
  return (
    [
      ['Kind Clinic — Oak Lawn', '75219', true],
      ['CAN Community Health', '75219', true],
      ['Prism Health North Texas — Oak Lawn', '75204', true],
      ['Oak Lawn UMC testing', '75219', false],
      ['UT Southwestern CPIU', '75247', true],
      ['Dallas County HHS', '75207', true],
      ['Prism Health — Oak Cliff', '75208', true],
      ['The Stewpot', '75201', false],
    ] as [string, string, boolean][]
  ).map(([name, zip, v], i) => ({
    id: 'PL-' + (300 + i),
    name,
    zip,
    verified: v,
    status: v ? 'verified' : 'open',
  }));
}

export function seedRegions(): Record<string, boolean> {
  return Object.fromEntries(RISK_COUNTRIES.map((c, i) => [c, i < 23]));
}

export function seedAudit(): SeedAudit[] {
  if (!SEEDS_ENABLED) return [];
  return (
    [
      [4, 'Rafa (T&S)', 'Warned Plaid (PR-20931) · Guidelines → No hate'],
      [18, 'System', 'Auto-hid 3 scam profiles (score > 0.92)'],
      [42, 'Jordan (T&S)', 'Suspended Nomad 7 days (PR-21077)'],
      [75, 'Kai (Admin)', 'Added Poland to watch list'],
      [120, 'Ana (Support)', 'Resolved SP-5512 (billing)'],
    ] as [number, string, string][]
  ).map(([m, who, what]) => ({ m, who, what }));
}

/** "5m ago" / "2h ago" from a minutes-ago value. */
export function agoLabel(m: number): string {
  return m < 60 ? m + 'm ago' : Math.round(m / 60) + 'h ago';
}

/** A wall-clock stamp "YYYY-MM-DD HH:MM" for N minutes ago, for the audit log. */
export function stampLabel(m: number): string {
  return new Date(Date.now() - m * 60000).toISOString().replace('T', ' ').slice(0, 16);
}
