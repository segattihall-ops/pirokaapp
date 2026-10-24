/**
 * Report reasons and the severity used for the admin queue and the 4h/24h clocks.
 *
 * Rank 3 (critical) is the safety clock: 4 hours. Ranks 2 and 1 share the 24-hour clock.
 * Critical sorts first. The map is the only list the report UI and the report APIs may use.
 * Choices are written up in docs/trust-safety/REPORT_SEVERITY.md.
 */

export const SEVERITY_RANK = {
  critical: 3,
  medium: 2,
  low: 1,
} as const;

export type SeverityRank = (typeof SEVERITY_RANK)[keyof typeof SEVERITY_RANK];
export type SeverityName = keyof typeof SEVERITY_RANK;

/** Slugs accepted by the in-app report menu and POST /api/safety/report. */
export const IN_APP_REASONS = [
  'underage',
  'csam',
  'threats',
  'stalking',
  'sextortion',
  'ncii',
  'harassment',
  'hate',
  'unsafe',
  'spam',
  'impersonation',
  'other',
] as const;

export type InAppReason = (typeof IN_APP_REASONS)[number];

export const IN_APP_REASON_LABELS: Record<InAppReason, string> = {
  underage: 'Looks under 18',
  csam: 'Sexual content involving a minor',
  threats: 'Threat of violence',
  stalking: 'Stalking, doxxing, or sharing my location',
  sextortion: 'Coercion or sextortion',
  ncii: 'Intimate images shared without consent',
  harassment: 'Harassment',
  hate: 'Hate or discrimination',
  unsafe: 'Unsafe meet-up behaviour',
  spam: 'Spam or scam',
  impersonation: 'Impersonation',
  other: 'Something else',
};

/** Public "Report or request removal" labels. Stored reason is PUBLIC_QUEUE_REASON[label]. */
export const PUBLIC_REPORT_TYPES = [
  'Someone under 18',
  'Sexual content involving a minor',
  'Shared without consent',
  'Trafficking or commercial sexual services',
  'Threats or stalking',
  'Impersonation',
  'Harassment or hate',
  'Scam or spam',
  'Illegal content',
  'Other',
] as const;

export type PublicReportType = (typeof PUBLIC_REPORT_TYPES)[number];

export const PUBLIC_QUEUE_REASON: Record<PublicReportType, string> = {
  'Someone under 18': 'Underage',
  'Sexual content involving a minor': 'CSAM',
  'Shared without consent': 'Shared my photos',
  'Trafficking or commercial sexual services': 'Trafficking',
  'Threats or stalking': 'Threats or stalking',
  Impersonation: 'Fake or impersonation',
  'Harassment or hate': 'Harassment or hate',
  'Scam or spam': 'Scam or spam',
  'Illegal content': 'Illegal content',
  Other: 'Other',
};

/**
 * Every stored reason the queue can see. Unknown strings fall through to low (rank 1)
 * so a new slug cannot silently look critical, and the unit test fails if a known slug is absent.
 */
export const REASON_SEVERITY: Record<string, SeverityRank> = {
  // Critical — 4h clock. In-app slugs.
  underage: SEVERITY_RANK.critical,
  csam: SEVERITY_RANK.critical,
  threats: SEVERITY_RANK.critical,
  stalking: SEVERITY_RANK.critical,
  sextortion: SEVERITY_RANK.critical,
  ncii: SEVERITY_RANK.critical,
  // Critical — the same cases as stored by the public form and the older demo queue.
  Underage: SEVERITY_RANK.critical,
  CSAM: SEVERITY_RANK.critical,
  Trafficking: SEVERITY_RANK.critical,
  'Threats or violence': SEVERITY_RANK.critical,
  'Threats or stalking': SEVERITY_RANK.critical,
  'Shared my photos': SEVERITY_RANK.critical,
  'Illegal content': SEVERITY_RANK.critical,
  // Medium — 24h.
  harassment: SEVERITY_RANK.medium,
  Harassment: SEVERITY_RANK.medium,
  hate: SEVERITY_RANK.medium,
  'Harassment or hate': SEVERITY_RANK.medium,
  'Hate or discrimination': SEVERITY_RANK.medium,
  unsafe: SEVERITY_RANK.medium,
  // Low — 24h.
  spam: SEVERITY_RANK.low,
  'Scam or spam': SEVERITY_RANK.low,
  impersonation: SEVERITY_RANK.low,
  'Fake or impersonation': SEVERITY_RANK.low,
  other: SEVERITY_RANK.low,
  Other: SEVERITY_RANK.low,
};

/** Demo-queue alias. Same object the admin console already imports as SEV. */
export const SEV = REASON_SEVERITY;

export function severityRank(reason: string): SeverityRank {
  return REASON_SEVERITY[reason] ?? SEVERITY_RANK.low;
}

export function severityName(rank: SeverityRank): SeverityName {
  if (rank === SEVERITY_RANK.critical) return 'critical';
  if (rank === SEVERITY_RANK.medium) return 'medium';
  return 'low';
}

export function severityLabel(rank: number): string {
  if (rank === SEVERITY_RANK.critical) return 'Critical';
  if (rank === SEVERITY_RANK.medium) return 'Medium';
  return 'Low';
}

export function isCriticalReason(reason: string): boolean {
  return severityRank(reason) === SEVERITY_RANK.critical;
}

export type QueueItem = { reason: string; createdAt: string };

/** Critical first, then medium, then low. Newer reports first inside the same rank. */
export function compareReportQueue(a: QueueItem, b: QueueItem): number {
  const bySeverity = severityRank(b.reason) - severityRank(a.reason);
  if (bySeverity !== 0) return bySeverity;
  const aMs = Date.parse(a.createdAt);
  const bMs = Date.parse(b.createdAt);
  return (Number.isFinite(bMs) ? bMs : 0) - (Number.isFinite(aMs) ? aMs : 0);
}

export function sortReportQueue<T extends QueueItem>(rows: T[]): T[] {
  return rows.slice().sort(compareReportQueue);
}

const REASON_TOKEN = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,40}$/;
/** Report ids are `TS-#####` or a uuid. Anything else is dropped so a narrative cannot ride along. */
const REPORT_ID = /^(?:TS-[A-Za-z0-9]{1,24}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/**
 * Ops alert body. Only a controlled reason token, the severity, the report id, and the admin link.
 * Narratives, coordinates, handles, and contact details are not parameters of this function.
 */
export function reportAlertText(input: { reason: string; reportId: string; origin: string }): string {
  const reason =
    REASON_TOKEN.test(input.reason) && input.reason in REASON_SEVERITY ? input.reason : 'unknown';
  const id = REPORT_ID.test(input.reportId.trim()) ? input.reportId.trim() : 'unknown';
  const origin = input.origin.replace(/[\s\r\n]+/g, '').replace(/\/+$/, '');
  const severity = severityName(severityRank(reason === 'unknown' ? '' : reason));
  return `type=${reason} severity=${severity} id=${id} ${origin}/admin/reports`;
}
