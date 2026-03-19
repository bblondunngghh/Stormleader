-- SRS Distribution Materials Integration
-- Material orders and SRS API credentials

CREATE TABLE IF NOT EXISTS material_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  estimate_id   UUID REFERENCES estimates(id) ON DELETE SET NULL,
  srs_order_id  TEXT,
  status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','submitted','confirmed','shipped','delivered')),
  items         JSONB NOT NULL DEFAULT '[]'::jsonb,
  branch_id     TEXT,
  branch_name   TEXT,
  total_cost    NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_material_orders_tenant ON material_orders(tenant_id);
CREATE INDEX idx_material_orders_estimate ON material_orders(estimate_id);
CREATE INDEX idx_material_orders_status ON material_orders(status);

CREATE TABLE IF NOT EXISTS srs_credentials (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  srs_api_key             TEXT,
  srs_account_id          TEXT,
  preferred_branch_id     TEXT,
  preferred_branch_name   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_srs_credentials_tenant ON srs_credentials(tenant_id);
