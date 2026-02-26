-- ============================================================
-- ESTIMATES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Auto-generated per tenant
  estimate_number VARCHAR(20) NOT NULL,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired')),

  -- Customer info (snapshot at estimate creation time)
  customer_name VARCHAR(255),
  customer_address TEXT,
  customer_phone VARCHAR(30),
  customer_email VARCHAR(255),

  -- Line items stored as JSONB
  -- Each item: { description, quantity, unit, unit_price, total, section }
  line_items JSONB NOT NULL DEFAULT '[]',

  -- Totals
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,4) DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  discount_type VARCHAR(10) DEFAULT 'flat' CHECK (discount_type IN ('flat', 'percent')),
  discount_value NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Content
  scope_of_work TEXT,
  terms TEXT,
  warranty_info TEXT,
  notes TEXT,

  -- Validity
  valid_until DATE,

  -- Customer access
  public_token VARCHAR(64) UNIQUE,

  -- Signature
  signature_data TEXT, -- base64 of signature image
  signed_at TIMESTAMPTZ,
  signer_name VARCHAR(255),

  -- Timestamps
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_estimates_tenant ON estimates(tenant_id);
CREATE INDEX idx_estimates_lead ON estimates(lead_id);
CREATE INDEX idx_estimates_status ON estimates(tenant_id, status);
CREATE INDEX idx_estimates_public_token ON estimates(public_token) WHERE public_token IS NOT NULL;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_estimates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_estimates_updated_at
  BEFORE UPDATE ON estimates
  FOR EACH ROW EXECUTE FUNCTION update_estimates_updated_at();

-- ============================================================
-- ESTIMATE TEMPLATES (per tenant line item presets)
-- ============================================================

CREATE TABLE IF NOT EXISTS estimate_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255),
  unit VARCHAR(30) DEFAULT 'each',
  default_unit_price NUMERIC(10,2),
  section VARCHAR(50) DEFAULT 'Roof',
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_estimate_templates_tenant ON estimate_templates(tenant_id);

-- Seed common roofing estimate presets (for all existing tenants)
INSERT INTO estimate_templates (tenant_id, name, description, unit, default_unit_price, section, position)
SELECT t.id, preset.name, preset.description, preset.unit, preset.price, preset.section, preset.pos
FROM tenants t
CROSS JOIN (VALUES
  ('Tear Off & Replace', 'Remove existing shingles and install new', 'sq', 350.00, 'Roof', 0),
  ('Architectural Shingles', 'GAF Timberline HDZ or equivalent', 'sq', 125.00, 'Roof', 1),
  ('Underlayment', 'Synthetic underlayment', 'sq', 45.00, 'Roof', 2),
  ('Ridge Cap', 'Hip and ridge cap shingles', 'lf', 6.50, 'Roof', 3),
  ('Drip Edge', 'Aluminum drip edge', 'lf', 4.00, 'Roof', 4),
  ('Ice & Water Shield', 'Self-adhering membrane at eaves/valleys', 'sq', 95.00, 'Roof', 5),
  ('Pipe Boot', 'Replace pipe boot flashing', 'each', 45.00, 'Roof', 6),
  ('Flashing', 'Step/counter flashing replacement', 'lf', 12.00, 'Roof', 7),
  ('Ventilation', 'Ridge vent or box vent', 'each', 65.00, 'Roof', 8),
  ('Skylights', 'Re-flash existing skylight', 'each', 250.00, 'Roof', 9),
  ('Gutter Replacement', 'Seamless aluminum gutters', 'lf', 8.50, 'Gutters', 10),
  ('Downspout', 'Aluminum downspout', 'lf', 6.00, 'Gutters', 11),
  ('Fascia Board', 'Replace damaged fascia', 'lf', 10.00, 'Misc', 12),
  ('Soffit Repair', 'Repair or replace soffit panels', 'lf', 12.00, 'Misc', 13),
  ('Dumpster / Haul Off', 'Debris removal', 'each', 450.00, 'Misc', 14)
) AS preset(name, description, unit, price, section, pos)
ON CONFLICT DO NOTHING;
