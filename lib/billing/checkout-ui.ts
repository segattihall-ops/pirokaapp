/**
 * Client-side checkout visibility. The browser must not decide this from
 * NEXT_PUBLIC_PAYPAL_* alone — those are fixed at build time. /api/billing/status
 * reports billingEnabled and configured on each request.
 */

/** Neutral copy on Me → Plan & billing while new charges are switched off. */
export const BILLING_UNAVAILABLE_COPY = 'Billing not available yet.';

export type BillingAvailability = {
  configured?: boolean;
  billingEnabled?: boolean;
} | null;

export function billingOff(status: { billingEnabled?: boolean } | null | undefined): boolean {
  return status?.billingEnabled === false;
}

/**
 * PayPal Buttons render only after the server says checkout is open.
 * publicClientReady is the build-time client id + plan ids, which are necessary
 * to mount the SDK and not sufficient to show it.
 */
export function paypalButtonsAllowed(status: BillingAvailability, publicClientReady: boolean): boolean {
  if (!status || status.billingEnabled === false || status.configured !== true) return false;
  return publicClientReady;
}
