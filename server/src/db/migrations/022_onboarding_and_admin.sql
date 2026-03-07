-- 022_onboarding_and_admin.sql
-- Tenant self-service onboarding + super-admin dashboard support

-- ============================================================
-- 1. Extend tenants table
-- ============================================================
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trialing';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days');
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_phone TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_website TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_address TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS sender_email TEXT;

-- Ensure roof_measurement_enabled exists on skip trace config
ALTER TABLE tenant_skip_trace_config ADD COLUMN IF NOT EXISTS roof_measurement_enabled BOOLEAN DEFAULT false;

-- ============================================================
-- 2. Subscription plans table
-- ============================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  stripe_price_id TEXT,
  features JSONB DEFAULT '[]',
  max_users INTEGER DEFAULT 3,
  max_leads INTEGER DEFAULT 500,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. Seed plans (idempotent)
-- ============================================================
INSERT INTO subscription_plans (key, name, price_cents, max_users, max_leads, features) VALUES
  ('starter', 'Starter', 2000, 3, 1000, '["Storm map", "Lead management", "Basic pipeline"]'),
  ('pro', 'Pro', 4900, 10, 10000, '["Everything in Starter", "Skip trace", "Roof measurements", "Estimates", "Team management"]'),
  ('enterprise', 'Enterprise', 9900, 999, 999999, '["Everything in Pro", "API access", "Custom integrations", "Priority support", "Unlimited users & leads"]')
ON CONFLICT (key) DO UPDATE SET price_cents = EXCLUDED.price_cents, max_users = EXCLUDED.max_users, max_leads = EXCLUDED.max_leads, features = EXCLUDED.features;

-- ============================================================
-- 4. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tenants_subscription_status ON tenants(subscription_status);
CREATE INDEX IF NOT EXISTS idx_tenants_subscription_tier ON tenants(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_tenants_created_at ON tenants(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenants_trial_ends_at ON tenants(trial_ends_at) WHERE onboarding_completed = false;
