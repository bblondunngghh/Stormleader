-- Financing Integration (Hearth)

-- financing_lenders: tenant's connected lender accounts
CREATE TABLE IF NOT EXISTS financing_lenders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('hearth', 'mock')),
  api_key_encrypted BYTEA,
  merchant_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, provider)
);

CREATE TRIGGER set_financing_lenders_updated_at
  BEFORE UPDATE ON financing_lenders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_financing_lenders_tenant ON financing_lenders(tenant_id);

-- financing_plans: available plans from lender
CREATE TABLE IF NOT EXISTS financing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lender_id UUID NOT NULL REFERENCES financing_lenders(id) ON DELETE CASCADE,
  external_plan_id TEXT NOT NULL,
  name TEXT NOT NULL,
  term_months INTEGER NOT NULL,
  apr NUMERIC(5,2) NOT NULL,
  dealer_fee_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  min_amount INTEGER NOT NULL DEFAULT 0,
  max_amount INTEGER NOT NULL DEFAULT 50000000,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lender_id, external_plan_id)
);

CREATE TRIGGER set_financing_plans_updated_at
  BEFORE UPDATE ON financing_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_financing_plans_tenant ON financing_plans(tenant_id);
CREATE INDEX idx_financing_plans_lender ON financing_plans(lender_id);

-- financing_applications: customer financing journey
CREATE TABLE IF NOT EXISTS financing_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  lender_id UUID NOT NULL REFERENCES financing_lenders(id) ON DELETE RESTRICT,
  plan_id UUID NOT NULL REFERENCES financing_plans(id) ON DELETE RESTRICT,
  external_application_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','redirected','applied','approved','funded','declined','expired')),
  amount INTEGER NOT NULL,
  approved_amount INTEGER,
  monthly_payment INTEGER,
  redirect_url TEXT,
  customer_name TEXT,
  customer_email TEXT,
  applied_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  funded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (estimate_id, plan_id)
);

CREATE TRIGGER set_financing_applications_updated_at
  BEFORE UPDATE ON financing_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_financing_apps_tenant ON financing_applications(tenant_id);
CREATE INDEX idx_financing_apps_estimate ON financing_applications(estimate_id);
CREATE INDEX idx_financing_apps_lead ON financing_applications(lead_id);
CREATE INDEX idx_financing_apps_external ON financing_applications(external_application_id);

-- Add financing columns to estimates
ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS financing_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS financing_plan_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
