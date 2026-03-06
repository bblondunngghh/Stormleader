-- Add roof_measurement_enabled to tenant config
ALTER TABLE tenant_skip_trace_config ADD COLUMN IF NOT EXISTS roof_measurement_enabled BOOLEAN DEFAULT false;

-- Roof measurement usage tracking
CREATE TABLE IF NOT EXISTS roof_measurement_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  roof_sqft NUMERIC(10,2),
  roof_segments INTEGER,
  avg_pitch_degrees NUMERIC(5,2),
  cost_cents INTEGER NOT NULL DEFAULT 10,
  billed BOOLEAN NOT NULL DEFAULT false,
  invoice_id TEXT,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roof_measurement_usage_tenant ON roof_measurement_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_roof_measurement_usage_billed ON roof_measurement_usage(tenant_id, billed) WHERE billed = false;

-- Add roof measurement columns to properties
ALTER TABLE properties ADD COLUMN IF NOT EXISTS roof_pitch_degrees NUMERIC(5,2);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS roof_segments INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS roof_measurement_source VARCHAR(50);
