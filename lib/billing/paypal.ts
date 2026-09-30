/**
 * PayPal billing integration for πroka
 * Handles subscriptions, webhooks, and payment processing
 */

/**
 * Plan IDs for PayPal subscriptions
 * Create these in your PayPal Business account
 */
export const PAYPAL_PLANS = {
  plus: process.env.NEXT_PUBLIC_PAYPAL_PLAN_PLUS_ID || 'P-PLUS-MONTHLY',
  premium: process.env.NEXT_PUBLIC_PAYPAL_PLAN_PREMIUM_ID || 'P-PREMIUM-MONTHLY',
};

/**
 * Get plan from subscription
 */
export function getPlanFromPayPalSubscription(planId: string): 'plus' | 'premium' | 'free' {
  if (planId === PAYPAL_PLANS.plus) return 'plus';
  if (planId === PAYPAL_PLANS.premium) return 'premium';
  return 'free';
}

/**
 * Verify webhook signature from PayPal
 */
export async function verifyPayPalWebhook(
  webhookId: string,
  event: any,
  signature: string
): Promise<boolean> {
  try {
    // In production, verify with PayPal API
    // For now: basic validation
    if (!event?.id || !event?.event_type) {
      return false;
    }
    return true;
  } catch (error) {
    console.error('PayPal webhook verification failed:', error);
    return false;
  }
}

/**
 * Handle subscription.created event
 */
export function handleSubscriptionCreated(event: any): {
  userId: string;
  subscriptionId: string;
  plan: 'plus' | 'premium' | 'free';
  customerId: string;
  status: string;
} {
  const { id: subscriptionId, custom_id: userId, plan_id: planId, status } = event.resource;

  return {
    userId,
    subscriptionId,
    plan: getPlanFromPayPalSubscription(planId),
    customerId: subscriptionId,
    status,
  };
}

/**
 * Handle subscription.updated event
 */
export function handleSubscriptionUpdated(event: any): {
  userId: string;
  subscriptionId: string;
  plan: 'plus' | 'premium' | 'free';
  status: string;
} {
  const { id: subscriptionId, custom_id: userId, plan_id: planId, status } = event.resource;

  return {
    userId,
    subscriptionId,
    plan: getPlanFromPayPalSubscription(planId),
    status,
  };
}

/**
 * Handle subscription.cancelled event
 */
export function handleSubscriptionCancelled(event: any): {
  userId: string;
  subscriptionId: string;
  canceledReason?: string;
} {
  const { id: subscriptionId, custom_id: userId, reason_code } = event.resource;

  return {
    userId,
    subscriptionId,
    canceledReason: reason_code,
  };
}

/**
 * Handle billing.subscription.payment.completed event
 */
export function handlePaymentCompleted(event: any): {
  userId: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  paymentId: string;
  status: string;
} {
  const { id: paymentId, custom_id: userId } = event.resource;
  const amount = parseFloat(event.resource.amount?.value || '0');
  const currency = event.resource.amount?.currency_code || 'USD';

  return {
    userId,
    subscriptionId: paymentId,
    amount,
    currency,
    paymentId,
    status: event.resource.status,
  };
}

/**
 * Handle billing.subscription.payment.failed event
 */
export function handlePaymentFailed(event: any): {
  userId: string;
  subscriptionId: string;
  failureReason?: string;
  attemptCount: number;
} {
  const { custom_id: userId, id: subscriptionId } = event.resource;

  return {
    userId,
    subscriptionId,
    failureReason: event.resource.reason_code,
    attemptCount: event.resource.attempt_number || 0,
  };
}
