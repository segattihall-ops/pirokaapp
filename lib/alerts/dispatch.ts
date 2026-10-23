import { appUrl } from '@/lib/app-url';
import {
  ADMIN_PATH,
  OPS_ALERT_DEDUPE_MS,
  type AlertKind,
  opsAlertKey,
  opsAlertsConfigured,
  parseOpsAlertEmails,
  redactOpsAlert,
} from './policy';

/**
 * Deliver one ops alert to email and/or a Slack/Discord webhook.
 * Redacts the body first, skips a repeat of the same key for a few minutes,
 * and never throws — a dead inbox or webhook must not fail the request that noticed the event.
 */

const ICON: Record<AlertKind, string> = {
  payment: '💳',
  report: '🚩',
  error: '🔥',
  feedback: '💬',
  signup: '🎉',
  ops: '🛠️',
};

const DEFAULT_TIMEOUT_MS = 8000;
const defaultSeen = new Map<string, number>();

export type OpsEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type DispatchResult = {
  ok: boolean;
  deduped: boolean;
  emailed: number;
  webhook: 'skipped' | 'sent' | 'failed';
};

export type OpsAlertDeps = {
  env: NodeJS.ProcessEnv;
  now: () => number;
  fetch: typeof fetch;
  sendEmail: (input: OpsEmail) => Promise<{ ok: boolean }>;
  /** Override the link origin. Production uses appUrl(). */
  origin?: string;
  seen?: Map<string, number>;
  timeoutMs?: number;
  info?: (message: string) => void;
  error?: (message: string) => void;
};

export function buildOpsAlert(
  kind: AlertKind,
  message: string,
  at: Date,
  origin: string,
): { subject: string; text: string } {
  let safe = redactOpsAlert(message).trim();
  if (!safe) safe = kind;
  if (!safe.includes('/admin')) {
    const path = ADMIN_PATH[kind] ?? '/admin';
    safe = `${safe} · ${origin}${path}`;
  }
  const type = String(kind)
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 40);
  const text = `${ICON[kind]} [πroka ${kind}] ${safe} · ${at.toISOString()}`.slice(0, 1900);
  return { subject: `[PIROKA alert] ${type}`, text };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    p.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

function reserve(seen: Map<string, number>, key: string, now: number, windowMs: number): boolean {
  for (const [k, t] of seen) {
    if (now - t >= windowMs) seen.delete(k);
  }
  const prev = seen.get(key);
  if (prev !== undefined && now - prev < windowMs) return false;
  seen.set(key, now);
  if (seen.size > 2000) {
    const oldest = seen.keys().next().value;
    if (oldest !== undefined && oldest !== key) seen.delete(oldest);
  }
  return true;
}

function webhookUrl(env: NodeJS.ProcessEnv): string | null {
  const url = env.OPS_WEBHOOK_URL?.trim();
  return url || null;
}

export async function dispatchOpsAlert(
  kind: AlertKind,
  message: string,
  deps: OpsAlertDeps,
): Promise<DispatchResult> {
  const at = new Date(deps.now());
  const origin = (deps.origin ?? appUrl()).replace(/\/+$/, '');
  const { subject, text } = buildOpsAlert(kind, message, at, origin);
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!opsAlertsConfigured(deps.env)) {
    deps.info?.(`[ops-alert:console] ${text}`);
    return { ok: false, deduped: false, emailed: 0, webhook: 'skipped' };
  }

  const seen = deps.seen ?? defaultSeen;
  const key = opsAlertKey(kind, message);
  if (!reserve(seen, key, at.getTime(), OPS_ALERT_DEDUPE_MS)) {
    return { ok: true, deduped: true, emailed: 0, webhook: 'skipped' };
  }

  const html = `<p style="white-space:pre-wrap;font-family:ui-sans-serif,system-ui,sans-serif">${escapeHtml(text)}</p>`;
  let emailed = 0;
  let webhook: DispatchResult['webhook'] = 'skipped';
  try {
    const emails = parseOpsAlertEmails(deps.env.OPS_ALERT_EMAIL);
    if (emails.length) {
      const results = await Promise.all(
        emails.map(async (to) => {
          try {
            return await withTimeout(
              Promise.resolve().then(() => deps.sendEmail({ to, subject, html, text })),
              timeoutMs,
              { ok: false },
            );
          } catch {
            return { ok: false };
          }
        }),
      );
      emailed = results.filter((r) => r.ok).length;
      if (emailed < emails.length) deps.error?.('ops alert email failed');
    }

    const hook = webhookUrl(deps.env);
    if (hook) {
      const response = await withTimeout(
        Promise.resolve()
          .then(() =>
            deps.fetch(hook, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text, content: text }),
              cache: 'no-store',
              signal: AbortSignal.timeout(timeoutMs),
            }),
          )
          .then(
            (response) => response,
            () => null,
          ),
        timeoutMs + 250,
        null,
      );
      if (response?.ok) webhook = 'sent';
      else {
        webhook = 'failed';
        deps.error?.(response ? `ops webhook responded ${response.status}` : 'ops webhook failed');
      }
    }
  } catch {
    deps.error?.('ops alert failed');
  }

  const ok = emailed > 0 || webhook === 'sent';
  if (!ok) seen.delete(key);
  return { ok, deduped: false, emailed, webhook };
}
