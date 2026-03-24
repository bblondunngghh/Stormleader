-- Subcontractor management
CREATE TABLE IF NOT EXISTS subcontractors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  name          VARCHAR(255) NOT NULL,
  company       VARCHAR(255),
  phone         VARCHAR(50),
  email         VARCHAR(255),
  specialty     VARCHAR(100) NOT NULL DEFAULT 'general',
  hourly_rate   NUMERIC(10,2),
  notes         TEXT,
  status        VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subcontractors_tenant ON subcontractors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subcontractors_status ON subcontractors(tenant_id, status);

-- Link subcontractors to work orders
CREATE TABLE IF NOT EXISTS work_order_subcontractors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id   UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  subcontractor_id UUID NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
  role            VARCHAR(100),
  agreed_rate     NUMERIC(10,2),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(work_order_id, subcontractor_id)
);

CREATE INDEX IF NOT EXISTS idx_wo_subs_wo ON work_order_subcontractors(work_order_id);
CREATE INDEX IF NOT EXISTS idx_wo_subs_sub ON work_order_subcontractors(subcontractor_id);
