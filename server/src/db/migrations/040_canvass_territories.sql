-- Canvassing territories for region assignment to reps
CREATE TABLE IF NOT EXISTS canvass_territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  color VARCHAR(50) DEFAULT 'oklch(0.65 0.27 29)',
  polygon GEOMETRY(POLYGON, 4326),
  assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  pin_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_canvass_territories_tenant ON canvass_territories(tenant_id);
CREATE INDEX idx_canvass_territories_polygon ON canvass_territories USING GIST (polygon);
CREATE INDEX idx_canvass_territories_user ON canvass_territories(assigned_user_id);

-- Add territory_id to canvass_pins for territory association
ALTER TABLE canvass_pins ADD COLUMN IF NOT EXISTS territory_id UUID REFERENCES canvass_territories(id) ON DELETE SET NULL;
