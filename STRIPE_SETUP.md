# Stripe Billing Setup for πroka

## Overview

πroka uses Stripe for subscription billing:
- **Plus**: $5/month (album limit, saved trips)
- **Premium**: $10/month (taste learning, smart search, early access)

This guide covers Stripe configuration and webhook setup.

---

## 1. Create Stripe Account

1. Go to https://dashboard.stripe.com/register
2. Sign up with your business email
3. Complete verification (may take 24-48 hours for full account access)

---

## 2. Create Products & Prices

In Stripe Dashboard:

### Plus Product
1. **Products** → **Create**
2. **Name**: `πroka Plus`
3. **Pricing model**: Recurring
4. **Billing period**: Monthly
5. **Price**: $5.00 USD
6. **Save** and copy the **Price ID** → Set as `NEXT_PUBLIC_STRIPE_PRICE_PLUS` in `.env`

### Premium Product
1. **Products** → **Create**
2. **Name**: `πroka Premium`
3. **Pricing model**: Recurring
4. **Billing period**: Monthly
5. **Price**: $10.00 USD
6. **Save** and copy the **Price ID** → Set as `NEXT_PUBLIC_STRIPE_PRICE_PREMIUM` in `.env`

---

## 3. Get API Keys

In Stripe Dashboard → **Developers** → **API keys**:

1. Copy **Publishable key** → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
2. Copy **Secret key** → `STRIPE_SECRET_KEY` (keep secret!)

---

## 4. Set Up Webhook

Webhooks deliver real-time subscription updates to `/api/webhooks/stripe`.

### Create Webhook Endpoint

1. **Developers** → **Webhooks** → **Add endpoint**
2. **Endpoint URL**: `https://your-domain.com/api/webhooks/stripe`
   - For Vercel: `https://pirokaapp-git-...mm-website.vercel.app/api/webhooks/stripe`
   - Or use production domain once live
3. **Events to send**:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. **Create endpoint**
5. Copy **Signing secret** → `STRIPE_WEBHOOK_SECRET`

### Test Webhook (Local Dev)

Use Stripe CLI:

```bash
# Install Stripe CLI
# macOS: brew install stripe/stripe-cli/stripe
# Linux: https://github.com/stripe/stripe-cli#installation

# Login to your Stripe account
stripe login

# Start webhook listener (forwards to localhost:3000)
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Copy the signing secret it displays
# Set it in .env.local as STRIPE_WEBHOOK_SECRET
```

---

## 5. Environment Variables

Add to `.env.local` (development) or Vercel (production):

```env
# Stripe Public (safe to expose)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx...

# Stripe Secret (DO NOT expose)
STRIPE_SECRET_KEY=sk_live_xxx...

# Price IDs
NEXT_PUBLIC_STRIPE_PRICE_PLUS=price_xxx...
NEXT_PUBLIC_STRIPE_PRICE_PREMIUM=price_xxx...

# Webhook Signing Secret
STRIPE_WEBHOOK_SECRET=whsec_xxx...
```

---

## 6. Test Subscription Flow

1. Start dev server: `npm run dev`
2. Go to `/app/account` (placeholder upgrade UI)
3. Click **Upgrade to Plus** or **Upgrade to Premium**
4. Test card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
5. Webhook should process immediately (check terminal logs)
6. Check database: `users.plan` should be updated

---

## 7. Production Checklist

- [ ] Stripe account verified (wait 24-48h if needed)
- [ ] Products created (Plus $5, Premium $10)
- [ ] API keys added to Vercel env vars
- [ ] Webhook endpoint created and verified
- [ ] Webhook secret in Vercel env vars
- [ ] Test subscription with real card or test card
- [ ] Monitor webhook logs in Stripe Dashboard
- [ ] Set up Stripe email receipts (automatic)

---

## Events Handled

| Event | Handler | Effect |
|-------|---------|--------|
| `customer.subscription.created` | `handleSubscriptionCreated` | User upgraded; set plan + Stripe IDs |
| `customer.subscription.updated` | `handleSubscriptionUpdated` | Plan changed; update plan |
| `customer.subscription.deleted` | `handleSubscriptionDeleted` | Subscription cancelled; downgrade to free |
| `invoice.payment_succeeded` | `handlePaymentSucceeded` | Log successful payment to audit_log |
| `invoice.payment_failed` | `handlePaymentFailed` | Log failed payment to audit_log |

---

## Troubleshooting

### Webhook not firing

1. Check **Developers** → **Webhooks** → event delivery log
2. Verify endpoint URL is correct (including protocol `https://`)
3. Check Vercel deployment logs for 404 or 500 errors
4. Ensure `STRIPE_WEBHOOK_SECRET` is set in Vercel

### Payment failing with "Stripe not configured"

1. Check `STRIPE_SECRET_KEY` is in Vercel env vars
2. Verify key starts with `sk_live_` (production) or `sk_test_` (test)
3. Redeploy after env var changes: `vercel env pull` then `vercel deploy --prod`

### User plan not updating

1. Check webhook delivery in Stripe Dashboard
2. Verify `users.plan` column exists in Supabase
3. Check Supabase RLS: `users` table must allow updates via auth
4. Look at application logs for `Failed to...` errors

---

## Testing Webhooks Without Real Payments

Use Stripe's test mode and Stripe CLI:

```bash
# In test mode, use test cards
4242 4242 4242 4242  (succeeds)
4000 0000 0000 0002  (fails)
4000 0000 0000 0069  (requires auth)

# Or trigger events manually via Stripe CLI
stripe trigger customer.subscription.updated \
  --add subscription:metadata.userId=abc123
```

---

## Next Steps

- [ ] Complete Stripe setup
- [ ] Deploy to Vercel with env vars
- [ ] Test full subscription flow
- [ ] Monitor payment success rate
- [ ] Set up Stripe email templates (optional)
- [ ] Add email notifications for subscription changes

---

**Support**: For Stripe issues, see https://support.stripe.com or https://stripe.com/docs
