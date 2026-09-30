# PayPal Subscriptions — setup

PayPal is the only payment provider. Plans: **Plus $5/mo**, **Premium $10/mo**.

## How it works

1. **Me → Your plan** renders the PayPal Buttons (`components/billing/paypal-checkout.tsx`) with
   `vault=true&intent=subscription`. `createSubscription` passes the plan ID and `custom_id = <our user id>`.
2. `onApprove` posts the subscription ID to `POST /api/billing/subscribe`, which fetches the subscription from
   PayPal, checks `custom_id` matches the signed-in user, and sets `users.plan` / `paypal_subscription_id`.
3. PayPal calls `POST /api/webhooks/paypal` for lifecycle events. The handler verifies the signature with
   PayPal's `verify-webhook-signature` API before touching the database, then keeps `users.plan`,
   `users.subscription_status` and the `payments` table in sync.
4. **Cancel** on the Me page calls `POST /api/billing/cancel` → PayPal cancel → plan back to `free`.

## Configure

Follow **KEYS.md → 2. PayPal**. Variables:

```
PAYPAL_ENV=sandbox|live
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
NEXT_PUBLIC_PAYPAL_CLIENT_ID=
NEXT_PUBLIC_PAYPAL_PLAN_PLUS_ID=P-…
NEXT_PUBLIC_PAYPAL_PLAN_PREMIUM_ID=P-…
```

Webhook events to subscribe: `BILLING.SUBSCRIPTION.ACTIVATED`, `BILLING.SUBSCRIPTION.UPDATED`,
`BILLING.SUBSCRIPTION.CANCELLED`, `BILLING.SUBSCRIPTION.SUSPENDED`, `BILLING.SUBSCRIPTION.EXPIRED`,
`BILLING.SUBSCRIPTION.PAYMENT.FAILED`, `PAYMENT.SALE.COMPLETED`.

Database: `lib/db/migrations/009_paypal_billing.sql` (adds `users.paypal_subscription_id`,
`users.subscription_status`, and `payments`).

## Test in sandbox

1. Developer dashboard → **Sandbox → Accounts**: use the auto-created *personal* buyer account.
2. Sign in to πroka, open **Me**, pick a plan, pay with the sandbox buyer.
3. Check Supabase: `select plan, subscription_status, paypal_subscription_id from users where id = '<you>'`.
4. Webhooks → your webhook → **Simulate** an event, or watch the live log after the real purchase.
5. Cancel from the Me page; `plan` returns to `free`.

## Go live

Create a Live REST app and Live plans (different IDs), register the Live webhook, set `PAYPAL_ENV=live`,
swap all seven variables in Vercel, redeploy.
