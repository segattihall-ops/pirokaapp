import 'server-only';
import { supabaseAdmin } from '@/lib/db/client';
import { paypalConfigured } from '@/lib/billing/paypal';
import { pushConfigured } from '@/lib/push/server';
import { emailConfigured, emailProvider } from '@/lib/email';
import { analyticsForwardingConfigured } from '@/lib/analytics/server';
import { errorForwardingConfigured } from '@/lib/errors/server';
import { opsAlertsConfigured } from '@/lib/alerts/server';

export type ComponentState = 'ok' | 'degraded' | 'off';
export type ComponentStatus = {
  key: string;
  label: string;
  state: ComponentState;
  detail: string;
  latencyMs?: number;
};
export type SystemStatus = { ok: boolean; checkedAt: string; components: ComponentStatus[] };

/** Public-safe view of what is wired up. Never includes a key, host or secret. */
export async function getSystemStatus(): Promise<SystemStatus> {
  const components: ComponentStatus[] = [];

  if (supabaseAdmin) {
    const t = Date.now();
    const { error } = await supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).limit(1);
    components.push({
      key: 'database',
      label: 'Database',
      state: error ? 'degraded' : 'ok',
      detail: error ? 'Query failed' : 'Supabase reachable',
      latencyMs: Date.now() - t,
    });
  } else {
    components.push({
      key: 'database',
      label: 'Database',
      state: 'off',
      detail: 'Demo mode (no Supabase keys)',
    });
  }

  components.push({
    key: 'email',
    label: 'Email',
    state: emailConfigured() ? 'ok' : 'off',
    detail: emailConfigured()
      ? `Provider: ${emailProvider()}`
      : 'Console only — set RESEND_API_KEY or EMAIL_SERVER',
  });
  components.push({
    key: 'billing',
    label: 'Billing',
    state: paypalConfigured() ? 'ok' : 'off',
    detail: paypalConfigured()
      ? `PayPal ${process.env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox'}`
      : 'PayPal keys missing',
  });
  components.push({
    key: 'push',
    label: 'Web push',
    state: pushConfigured() ? 'ok' : 'off',
    detail: pushConfigured() ? 'VAPID keys present' : 'VAPID keys missing',
  });
  components.push({
    key: 'analytics',
    label: 'Analytics',
    state: supabaseAdmin ? 'ok' : 'degraded',
    detail: `${supabaseAdmin ? 'Stored in Postgres' : 'Console only'}${analyticsForwardingConfigured() ? ' · mirrored to PostHog' : ''}`,
  });
  components.push({
    key: 'errors',
    label: 'Error tracking',
    state: supabaseAdmin ? 'ok' : 'degraded',
    detail: `${supabaseAdmin ? 'Stored in Postgres' : 'Console only'}${errorForwardingConfigured() ? ' · mirrored to Sentry' : ''}`,
  });
  components.push({
    key: 'alerts',
    label: 'Ops alerts',
    state: opsAlertsConfigured() ? 'ok' : 'off',
    detail: opsAlertsConfigured() ? 'Webhook configured' : 'OPS_WEBHOOK_URL missing',
  });
  components.push({
    key: 'cron',
    label: 'Scheduled jobs',
    state: process.env.CRON_SECRET ? 'ok' : 'off',
    detail: process.env.CRON_SECRET ? 'CRON_SECRET set' : 'CRON_SECRET missing',
  });
  components.push({
    key: 'age',
    label: 'Age verification',
    state: process.env.AGE_PROVIDER && process.env.AGE_PROVIDER !== 'local' ? 'ok' : 'degraded',
    detail:
      process.env.AGE_PROVIDER && process.env.AGE_PROVIDER !== 'local'
        ? `Provider: ${process.env.AGE_PROVIDER}`
        : 'Local demo provider',
  });

  return {
    ok: !components.some((c) => c.state === 'degraded' && c.key === 'database'),
    checkedAt: new Date().toISOString(),
    components,
  };
}
