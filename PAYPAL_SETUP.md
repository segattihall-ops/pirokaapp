# PayPal Billing Setup Guide

Complete guide to configure PayPal subscriptions for πroka.

---

## 1. Create PayPal Developer Account

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com)
2. Sign up or log in with your PayPal Business account
3. Create a new Sandbox app for testing

---

## 2. Get API Credentials

### Sandbox (Testing)
1. Go to **Apps & Credentials**
2. Select **Sandbox** environment
3. Under "REST API signature", copy:
   - **Client ID**
   - **Secret**

### Production
1. Switch to **Live** environment
2. Get your production Client ID and Secret
3. ⚠️ Never commit production credentials to git

---

## 3. Create Billing Plans

### Create Plus Plan ($5/month)
1. Go to **Billing Plans**
2. Click **Create Plan**
3. Fill in:
   - **Name:** πroka Plus
   - **Type:** Regular
   - **Billing Frequency:** Monthly
   - **Price:** $5.00
   - **Currency:** USD
   - **Billing Cycles:** Set to recurring
4. Copy the **Plan ID** (format: P-XXXX...)

### Create Premium Plan ($10/month)
1. Repeat above steps
2. Set price to **$10.00**
3. Name: πroka Premium
4. Copy the **Plan ID**

---

## 4. Environment Variables

Add to `.env.local`:

```env
# PayPal API Credentials
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_secret

# Billing Plan IDs
PAYPAL_PLAN_PLUS_ID=P-PLUS-MONTHLY-ID
PAYPAL_PLAN_PREMIUM_ID=P-PREMIUM-MONTHLY-ID

# Webhook
PAYPAL_WEBHOOK_ID=your_webhook_id
```

---

## 5. Create Webhook

### Register Webhook Endpoint
1. Go to **Webhooks** in PayPal Developer
2. Click **Create Webhook**
3. **Endpoint URL:**
   ```
   https://your-domain.com/api/webhooks/paypal
   ```
4. **Event Types:** Select all subscription events:
   - `billing.subscription.created`
   - `billing.subscription.updated`
   - `billing.subscription.cancelled`
   - `billing.subscription.payment.completed`
   - `billing.subscription.payment.failed`
5. Copy the **Webhook ID**

---

## 6. Database Updates

The following tables are used:

### users table
- `plan` (plus | premium | free)
- `paypal_subscription_id` (subscription ID)
- `subscription_status` (ACTIVE | CANCELLED | PAYMENT_FAILED)

### payments table (optional)
```sql
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  payment_id TEXT NOT NULL UNIQUE,
  amount DECIMAL(10, 2),
  currency VARCHAR(3),
  status TEXT, -- COMPLETED, FAILED
  provider TEXT, -- paypal
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 7. Testing

### Test Subscription Flow
1. Use PayPal Sandbox account
2. Create subscription with plan ID
3. Check webhook logs in `/api/webhooks/paypal`

### Test Webhook
Use PayPal Webhook Simulator:
1. Go to **Webhooks** dashboard
2. Find your webhook
3. Click **Send Test Event**
4. Select event type
5. Check logs for processing

---

## 8. Frontend Integration

### Subscribe Button
```typescript
import { PAYPAL_PLANS } from '@/lib/billing/paypal';

export function SubscribeButton() {
  return (
    <PayPalButtons
      createSubscription={(data, actions) =>
        actions.subscription.create({
          plan_id: PAYPAL_PLANS.plus,
          custom_id: userId, // Your user ID
        })
      }
      onApprove={(data) => {
        // Subscription created successfully
        console.log('Subscription ID:', data.subscriptionID);
      }}
    />
  );
}
```

---

## 9. Migrate from Stripe

If migrating existing Stripe subscriptions:

```sql
-- Update users with PayPal subscription IDs
UPDATE users SET 
  stripe_subscription_id = NULL,
  stripe_customer_id = NULL,
  paypal_subscription_id = NEW_PAYPAL_SUB_ID
WHERE id = USER_ID;
```

---

## 10. Production Checklist

- [ ] Create production PayPal account
- [ ] Register production apps
- [ ] Create production billing plans
- [ ] Update environment variables
- [ ] Register production webhook
- [ ] Test subscription flow
- [ ] Set up monitoring/alerts
- [ ] Document cancellation process
- [ ] Enable dispute handling
- [ ] Set refund policy

---

## Troubleshooting

### Webhook not firing
- Check webhook URL is publicly accessible
- Verify endpoint returns 200 OK
- Check webhook logs in PayPal dashboard

### Subscription not created
- Verify plan ID is correct
- Check custom_id (user ID) is passed
- Confirm user has PayPal account

### Payment failed
- Check PayPal account has sufficient funds
- Verify payment method on file
- Review failure reason in webhook

---

## References

- [PayPal Subscriptions API](https://developer.paypal.com/docs/subscriptions/)
- [PayPal Webhooks](https://developer.paypal.com/docs/webhooks/)
- [PayPal Node.js SDK](https://github.com/paypal/Checkout-NodeJS-SDK)

---

**Status:** Ready for testing ✅
