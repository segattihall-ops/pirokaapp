import 'server-only';

/**
 * PayPal Subscriptions (REST v1). Server only.
 * Env: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID, PAYPAL_ENV (sandbox|live),
 *      NEXT_PUBLIC_PAYPAL_PLAN_PLUS_ID, NEXT_PUBLIC_PAYPAL_PLAN_PREMIUM_ID
 */

export type Plan = 'free' | 'plus' | 'premium';

export const PAYPAL_PLANS = {
  plus: process.env.NEXT_PUBLIC_PAYPAL_PLAN_PLUS_ID ?? '',
  premium: process.env.NEXT_PUBLIC_PAYPAL_PLAN_PREMIUM_ID ?? '',
};

export function paypalBaseUrl() {
  return process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

export function paypalConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

export function planFromPayPalPlanId(planId: string | null | undefined): Plan {
  if (planId && planId === PAYPAL_PLANS.plus) return 'plus';
  if (planId && planId === PAYPAL_PLANS.premium) return 'premium';
  return 'free';
}

let tokenCache: { token: string; expiresAt: number } | null = null;

export async function getPayPalAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.token;
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error('PayPal is not configured');

  const r = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`PayPal auth failed: ${r.status} ${await r.text()}`);
  const j = (await r.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

async function paypalFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getPayPalAccessToken();
  const r = await fetch(`${paypalBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });
  if (r.status === 204) return undefined as T;
  const text = await r.text();
  if (!r.ok) throw new Error(`PayPal ${path} failed: ${r.status} ${text}`);
  return (text ? JSON.parse(text) : undefined) as T;
}

export type PayPalSubscription = {
  id: string;
  plan_id: string;
  status: 'APPROVAL_PENDING' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';
  custom_id?: string;
  subscriber?: { email_address?: string; payer_id?: string };
  billing_info?: { next_billing_time?: string; last_payment?: { amount?: { value: string; currency_code: string } } };
};

export function getPayPalSubscription(id: string) {
  return paypalFetch<PayPalSubscription>(`/v1/billing/subscriptions/${encodeURIComponent(id)}`);
}

export function cancelPayPalSubscription(id: string, reason = 'Cancelled by user') {
  return paypalFetch<void>(`/v1/billing/subscriptions/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export type WebhookHeaders = {
  transmissionId: string;
  transmissionTime: string;
  certUrl: string;
  authAlgo: string;
  transmissionSig: string;
};

export function webhookHeadersFrom(h: Headers): WebhookHeaders | null {
  const transmissionId = h.get('paypal-transmission-id');
  const transmissionTime = h.get('paypal-transmission-time');
  const certUrl = h.get('paypal-cert-url');
  const authAlgo = h.get('paypal-auth-algo');
  const transmissionSig = h.get('paypal-transmission-sig');
  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) return null;
  return { transmissionId, transmissionTime, certUrl, authAlgo, transmissionSig };
}

/** Asks PayPal to verify the webhook signature. Never trust an event that fails this. */
export async function verifyPayPalWebhook(headers: WebhookHeaders, event: unknown): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) throw new Error('PAYPAL_WEBHOOK_ID is not set');
  const r = await paypalFetch<{ verification_status: 'SUCCESS' | 'FAILURE' }>(
    '/v1/notifications/verify-webhook-signature',
    {
      method: 'POST',
      body: JSON.stringify({
        auth_algo: headers.authAlgo,
        cert_url: headers.certUrl,
        transmission_id: headers.transmissionId,
        transmission_sig: headers.transmissionSig,
        transmission_time: headers.transmissionTime,
        webhook_id: webhookId,
        webhook_event: event,
      }),
    },
  );
  return r.verification_status === 'SUCCESS';
}
