import { getSystemStatus } from '@/lib/status/server';

export const dynamic = 'force-dynamic';

const DOT: Record<string, string> = { ok: 'bg-green', degraded: 'bg-warning', off: 'bg-fg-4' };

const KEYS: Record<string, string> = {
  database: 'NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY',
  email: 'RESEND_API_KEY (preferred) or EMAIL_SERVER, EMAIL_FROM',
  billing: 'PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID, NEXT_PUBLIC_PAYPAL_*',
  push: 'NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT',
  analytics: 'POSTHOG_KEY, POSTHOG_HOST (optional mirror)',
  errors: 'SENTRY_DSN (optional mirror)',
  alerts: 'OPS_WEBHOOK_URL',
  cron: 'CRON_SECRET (Vercel Cron sends it automatically)',
  age: 'AGE_PROVIDER, YOTI_CLIENT_SDK_ID, YOTI_PEM_PATH',
};

export default async function IntegrationsPage() {
  const s = await getSystemStatus();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-h2 sm:text-h1">Integrations</h1>
        <p className="mt-1 text-[12px] text-fg-4">
          What is wired up on this deployment. Values never leave the server; see KEYS.md for where each key
          comes from.
        </p>
      </div>
      <ul className="glass flex flex-col rounded-card px-4">
        {s.components.map((c) => (
          <li key={c.key} className="flex items-start gap-3 border-t border-line-1 py-3 first:border-t-0">
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[c.state]}`} />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium">
                {c.label} <span className="text-[12px] text-fg-3">· {c.detail}</span>
              </p>
              <p className="font-mono text-[11px] text-fg-4">{KEYS[c.key]}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="glass rounded-card px-4 py-3.5 text-[12px] text-fg-3">
        <p className="font-semibold text-fg">Scheduled jobs (vercel.json)</p>
        <ul className="mt-1 list-disc pl-5">
          <li>/api/cron/safemeet · every 5 min · SafeMeet reminders</li>
          <li>/api/cron/campaigns · every 10 min · campaign batches</li>
          <li>/api/cron/lifecycle · daily · re-engagement, win-back, dunning</li>
          <li>/api/cron/digest · Mondays · admin digest email</li>
        </ul>
      </div>
    </div>
  );
}
