/**
 * Pure ops-alert rules: who is configured, what may be said, and how repeats collapse.
 * No I/O. Safe to unit test without the server runtime.
 */

export type AlertKind = 'payment' | 'report' | 'error' | 'feedback' | 'signup' | 'ops';

/** Same logical alert is not delivered again inside this window. */
export const OPS_ALERT_DEDUPE_MS = 5 * 60 * 1000;

export const ADMIN_PATH: Record<AlertKind, string> = {
  payment: '/admin/revenue',
  report: '/admin/reports',
  error: '/admin/errors',
  feedback: '/admin/feedback',
  signup: '/admin/users',
  ops: '/admin',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** One address or a comma-separated list. Invalid entries are dropped, not thrown. */
export function parseOpsAlertEmails(raw: string | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const email = part.trim().toLowerCase();
    if (!email || email.length > 254 || !EMAIL_RE.test(email) || out.includes(email)) continue;
    out.push(email);
  }
  return out;
}

export function opsWebhookConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.OPS_WEBHOOK_URL?.trim());
}

/**
 * `/api/status` detail. `email` / `webhook` / `email + webhook` when a channel is usable.
 * Off-detail names the missing configuration. Never includes a URL or address.
 */
export function opsAlertsDetail(env: NodeJS.ProcessEnv = process.env): string {
  const email = parseOpsAlertEmails(env.OPS_ALERT_EMAIL).length > 0;
  const webhook = opsWebhookConfigured(env);
  if (email && webhook) return 'email + webhook';
  if (email) return 'email';
  if (webhook) return 'webhook';
  if (env.OPS_ALERT_EMAIL?.trim()) return 'OPS_ALERT_EMAIL has no valid address';
  return 'OPS_ALERT_EMAIL and OPS_WEBHOOK_URL missing';
}

export function opsAlertsConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const detail = opsAlertsDetail(env);
  return detail === 'email' || detail === 'webhook' || detail === 'email + webhook';
}

function looksLikeLatLng(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const pair = (lat: number, lng: number) => Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  return pair(a, b) || pair(b, a);
}

/**
 * Alert text may keep type, ids, admin links, counts and timestamps.
 * Exact coordinates, chat bodies, identity-document numbers and report narratives are removed.
 */
export function redactOpsAlert(message: string): string {
  let s = message.replace(/\r\n/g, '\n');

  s = s.replace(/data:(?:image|application)\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/gi, '[id-doc]');
  s = s.replace(/[?&](?:lat|latitude|lng|lon|longitude)=[-+]?\d+(?:\.\d+)?/gi, '');
  s = s.replace(/\bgeo:[-+]?\d+(?:\.\d+)?,[-+]?\d+(?:\.\d+)?\b/gi, '[coords]');
  s = s.replace(/\b(?:lat(?:itude)?|lng|lon(?:gitude)?)\b\s*[:=]\s*[-+]?\d{1,3}(?:\.\d+)?/gi, '[coords]');
  s = s.replace(
    /(?<![\w.])([-+]?\d{1,3}\.\d{4,})\s*[,/]\s*([-+]?\d{1,3}\.\d{4,})(?![\w.])/g,
    (match, a: string, b: string) => (looksLikeLatLng(Number(a), Number(b)) ? '[coords]' : match),
  );
  s = s.replace(/\b\d{1,3}°\d{1,2}'\d{1,2}(?:\.\d+)?"?\s*[NSEW]\b/gi, '[coords]');

  s = s.replace(/(?<![\d-])\d{3}-\d{2}-\d{4}(?![\d-])/g, '[id-doc]');
  s = s.replace(
    /\b(?:passport|driver'?s?\s+licen[cs]e|national\s+id|identity\s+documents?|id\s+documents?|social\s+security(?:\s+number)?)\b\s*(?:#|no\.?|number|:)?\s*[A-Z0-9][A-Z0-9-]{3,}/gi,
    '[id-doc]',
  );
  s = s.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]');

  s = s.replace(/"[^"\n]{60,}"|'[^'\n]{60,}'/g, '[chat]');
  s = s.replace(
    /\b(?:private\s+)?(?:chat|message|dm|ciphertext|plaintext)(?:\s+(?:content|body|text))?\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^·\n]+)/gi,
    '[chat]',
  );
  s = s.replace(
    /\b(?:details|narrative|report\s+text|description)\s*[:=]\s*\S[^\n]{80,}/gi,
    '[narrative withheld]',
  );

  const lines = s
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > 1) {
    const rest = lines.slice(1).join(' ');
    s = rest.length > 80 ? `${lines[0]} · [narrative withheld]` : lines.join(' · ');
  } else {
    s = lines[0] ?? '';
  }

  if (s.length > 400) {
    const link = s.match(/https?:\/\/[^\s]+|\/admin(?:\/[a-z0-9-]+)?/i)?.[0] ?? '';
    s = `${s.slice(0, 160).trim()} …${link ? ` · ${link}` : ''} · [narrative withheld]`;
  }

  return s
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/(?: · ){2,}/g, ' · ')
    .trim();
}

/** Stable key for the dedupe window. The clock is not part of the key. */
export function opsAlertKey(kind: string, message: string): string {
  return `${kind}\n${redactOpsAlert(message)}`;
}
