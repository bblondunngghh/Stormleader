CREATE TYPE canvass_outcome AS ENUM (
  'not_home', 'interested', 'not_interested', 'scheduled', 'follow_up', 'already_customer'
);

CREATE TABLE IF NOT EXISTS canvass_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  location GEOMETRY(POINT, 4326),
  address VARCHAR(500),
  outcome canvass_outcome,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_canvass_pins_tenant ON canvass_pins(tenant_id);
CREATE INDEX idx_canvass_pins_user ON canvass_pins(user_id);
CREATE INDEX idx_canvass_pins_location ON canvass_pins USING GIST (location);
