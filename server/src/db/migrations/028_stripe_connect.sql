-- 028_stripe_connect.sql
-- Stripe Connect integration for multi-tenant payment processing

-- Add Stripe Connect columns to tenants
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE;

-- Payments table for tracking all payment intents
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  estimate_id UUID REFERENCES estimates(id) ON DELETE SET NULL,
  stripe_payment_intent_id TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL, -- cents
  application_fee INTEGER NOT NULL DEFAULT 0, -- cents
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  payment_method TEXT NOT NULL DEFAULT 'card' CHECK (payment_method IN ('card', 'ach')),
  customer_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_estimate_id ON payments(estimate_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_pi ON payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
