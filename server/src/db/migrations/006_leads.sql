CREATE TYPE lead_stage AS ENUM ('new', 'contacted', 'appt_set', 'inspected', 'estimate_sent', 'sold', 'lost');
CREATE TYPE lead_priority AS ENUM ('hot', 'warm', 'cold');

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id),
  storm_event_id UUID REFERENCES storm_events(id),
  assigned_rep_id UUID REFERENCES users(id),
  stage lead_stage DEFAULT 'new',
  priority lead_priority DEFAULT 'warm',
  estimated_value NUMERIC(10,2),
  insurance_company VARCHAR(255),
  insurance_claim_number VARCHAR(100),
  hail_size_in NUMERIC(4,2),
  contact_name VARCHAR(255),
  contact_phone VARCHAR(20),
  contact_email VARCHAR(255),
  damage_notes TEXT,
  address VARCHAR(500),
  city VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
