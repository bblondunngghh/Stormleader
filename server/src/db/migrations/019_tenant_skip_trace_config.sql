-- Add stripe_customer_id to tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Skip trace config per tenant
CREATE TABLE IF NOT EXISTS tenant_skip_trace_config (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  stripe_payment_method_id TEXT,
  card_last_four VARCHAR(4),
  card_brand VARCHAR(20),
  markup_cents INTEGER NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add job tracking columns to skip_trace_usage
ALTER TABLE skip_trace_usage ADD COLUMN IF NOT EXISTS job_id TEXT;
ALTER TABLE skip_trace_usage ADD COLUMN IF NOT EXISTS stripe_charge_id TEXT;
