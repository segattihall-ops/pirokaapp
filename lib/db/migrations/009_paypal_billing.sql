-- PayPal billing migration
-- Replaces Stripe with PayPal for subscriptions

-- Add PayPal columns to users table
ALTER TABLE IF EXISTS public.users
ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'INACTIVE';

-- Add comment
COMMENT ON COLUMN public.users.paypal_subscription_id IS 'PayPal subscription ID for active subscriptions';
COMMENT ON COLUMN public.users.subscription_status IS 'Subscription status: ACTIVE, CANCELLED, PAYMENT_FAILED, INACTIVE';

-- Create payments table for transaction history
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  payment_id TEXT NOT NULL UNIQUE,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status TEXT NOT NULL, -- COMPLETED, FAILED, PENDING
  provider TEXT NOT NULL DEFAULT 'paypal', -- paypal, stripe
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for user lookups
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_id ON public.payments(payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- RLS policies for payments table
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Users can view their own payments
CREATE POLICY "users_view_own_payments" ON public.payments
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert/update payments (from webhooks)
CREATE POLICY "service_role_manage_payments" ON public.payments
  FOR ALL
  USING (auth.role() = 'service_role');

-- Drop Stripe columns (optional - comment out if you want to keep for reference)
-- ALTER TABLE IF EXISTS public.users
-- DROP COLUMN IF EXISTS stripe_subscription_id,
-- DROP COLUMN IF EXISTS stripe_customer_id;
