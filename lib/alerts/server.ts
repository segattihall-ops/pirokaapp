import 'server-only';
import { sendEmail } from '@/lib/email';
import { dispatchOpsAlert } from './dispatch';
import { opsAlertsConfigured, opsAlertsDetail, type AlertKind } from './policy';

/**
 * Outbound ops alerts.
 *   OPS_ALERT_EMAIL — one or comma-separated inboxes, sent through the app email provider (Resend).
 *   OPS_WEBHOOK_URL — optional Slack/Discord incoming webhook ({ text, content }).
 * Either channel is enough. Bodies are redacted and the same key is skipped for five minutes.
 * Never throws.
 */

export type { AlertKind };
export { opsAlertsConfigured, opsAlertsDetail };

const seen = new Map<string, number>();

export async function opsAlert(kind: AlertKind, message: string): Promise<boolean> {
  try {
    const result = await dispatchOpsAlert(kind, message, {
      env: process.env,
      now: () => Date.now(),
      fetch: globalThis.fetch,
      seen,
      sendEmail: async (input) => {
        const res = await sendEmail({ ...input, template: 'ops-alert' });
        return { ok: res.ok };
      },
      info: (line) => console.info(line),
      error: (line) => console.error(line),
    });
    return result.ok;
  } catch {
    console.error('ops alert failed');
    return false;
  }
}
