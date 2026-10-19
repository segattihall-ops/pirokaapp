// Shared by the Partner dashboard (client) and its API routes. Copy and lists come from the
// prototype (design_handoff/design/Piroka Partners.dc.html).

export type ListingKind = 'place' | 'testing_site';

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export type HoursDay = { open: boolean; from: string; to: string };
export type Hours = HoursDay[];

export const VENUE_TAGS = [
  'Drag nights',
  'Dance floor',
  'Leather',
  'Patio',
  'Sober-friendly',
  'Trans safe space',
  'Accessible',
  'Women & sapphic nights',
  'Kitchen',
] as const;

export const CLINIC_TAGS = [
  'HIV',
  'Syphilis',
  'Gonorrhea',
  'Chlamydia',
  'Hep C',
  'PrEP',
  'PEP',
  'Doxy-PEP',
  'Walk-in',
  'Spanish-speaking',
  'Trans care',
] as const;

export type Listing = {
  /** `place:<uuid>` or `testing_site:<id>` */
  key: string;
  kind: ListingKind;
  id: string;
  name: string;
  /** Place kind (bar, club…) or 'clinic'. */
  type: string;
  address: string;
  /** Verified listing (partner identity checked by staff). */
  verified: boolean;
  lat: number;
  lon: number;
  hours: Hours;
  tags: string[];
  tagPool: readonly string[];
  role: 'owner' | 'manager';
};

export type PartnerEvent = {
  id: string;
  name: string;
  startsAt: string;
  capacity: number | null;
  rsvp: number;
  status: 'pending' | 'approved' | 'rejected';
  note: string | null;
};

export const typeLabel = (type: string) =>
  type === 'clinic' ? 'Clinic' : type.charAt(0).toUpperCase() + type.slice(1);
