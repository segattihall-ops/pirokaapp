/**
 * Launch kill switch for new PayPal charges.
 *
 * New Plus/Premium checkouts run only when BILLING_ENABLED is exactly "true".
 * Unset, empty, "false", "1", and "TRUE" all stay off. PayPal keys may remain set.
 *
 * Do not fold this into paypalConfigured(). Webhooks, cancellation, pause/resume,
 * and receipts must keep working for anyone who already subscribed.
 *
 * The value is read on each call (bracket access) so a runtime env change is not
 * frozen into the server bundle at build time.
 */

export type Env = Record<string, string | undefined>;

export const BILLING_DISABLED_DETAIL = 'billing disabled by BILLING_ENABLED';
export const BILLING_DISABLED_ERROR = 'Billing not available';

const BILLING_ENABLED = 'BILLING_ENABLED';
const PAYPAL_CLIENT_ID = 'PAYPAL_CLIENT_ID';
const PAYPAL_CLIENT_SECRET = 'PAYPAL_CLIENT_SECRET';
const PAYPAL_ENV = 'PAYPAL_ENV';

export function billingEnabled(env: Env = process.env): boolean {
  return env[BILLING_ENABLED] === 'true';
}

/** Server PayPal credentials exist. Independent of the kill switch. */
export function paypalKeysPresent(env: Env = process.env): boolean {
  return Boolean(env[PAYPAL_CLIENT_ID] && env[PAYPAL_CLIENT_SECRET]);
}

/** A new subscription may start: the flag is on and server PayPal keys exist. */
export function checkoutConfigured(env: Env = process.env): boolean {
  return billingEnabled(env) && paypalKeysPresent(env);
}

/** /api/status billing row. Flag off wins over missing keys so the reason is explicit. */
export function billingStatusDetail(env: Env = process.env): { state: 'ok' | 'off'; detail: string } {
  if (!billingEnabled(env)) return { state: 'off', detail: BILLING_DISABLED_DETAIL };
  if (!paypalKeysPresent(env)) return { state: 'off', detail: 'PayPal keys missing' };
  return { state: 'ok', detail: `PayPal ${env[PAYPAL_ENV] === 'live' ? 'live' : 'sandbox'}` };
}
