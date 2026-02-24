CREATE TYPE outreach_type AS ENUM ('call', 'email', 'sms', 'door_knock', 'note');
CREATE TYPE outreach_direction AS ENUM ('inbound', 'outbound');

CREATE TABLE outreach_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type outreach_type NOT NULL,
  direction outreach_direction DEFAULT 'outbound',
  outcome VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
