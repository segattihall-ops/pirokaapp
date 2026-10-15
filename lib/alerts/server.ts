import 'server-only';

/**
 * Outbound ops alerts to a Slack- or Discord-compatible incoming webhook (OPS_WEBHOOK_URL).
 * Both accept `{ "text": ... }` (Slack) / `{ "content": ... }` (Discord), so we send both keys.
 * Without a URL, alerts log to the console. Never throws.
 */

export type AlertKind = 'payment' | 'report' | 'error' | 'feedback' | 'signup' | 'ops';

const ICON: Record<AlertKind, string> = {
  payment: '💳',
  report: '🚩',
  error: '🔥',
  feedback: '💬',
  signup: '🎉',
  ops: '🛠️',
};

export function opsAlertsConfigured(): boolean {
  return Boolean(process.env.OPS_WEBHOOK_URL);
}

export async function opsAlert(kind: AlertKind, message: string): Promise<boolean> {
  const text = `${ICON[kind]} [πroka ${kind}] ${message}`.slice(0, 1900);
  const url = process.env.OPS_WEBHOOK_URL;
  if (!url) {
    console.info(`[ops-alert:console] ${text}`);
    return false;
  }
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, content: text }),
      cache: 'no-store',
    });
    if (!r.ok) console.error('ops webhook responded', r.status);
    return r.ok;
  } catch (e) {
    console.error('ops webhook failed', e);
    return false;
  }
}
