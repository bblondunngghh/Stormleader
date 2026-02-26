-- 015_crm_expansion.sql
-- CRM Phase 2: Expand lead schema, add contacts, activities, tasks, pipeline stages

-- ============================================================
-- 1. Add columns to leads
-- ============================================================
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source VARCHAR(50);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS actual_value NUMERIC(10,2);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_follow_up TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lost_reason VARCHAR(255);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ============================================================
-- 2. Contacts table (multiple contacts per lead)
-- ============================================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(255),
  role VARCHAR(50) DEFAULT 'homeowner',
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. Activities table (timeline of all interactions)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_type') THEN
    CREATE TYPE activity_type AS ENUM ('call', 'email', 'text', 'door_knock', 'note', 'status_change', 'task_completed', 'system');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type activity_type NOT NULL DEFAULT 'note',
  subject VARCHAR(255),
  notes TEXT,
  outcome VARCHAR(100),
  duration_seconds INT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 4. Tasks table (to-dos linked to leads)
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  priority lead_priority DEFAULT 'warm',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 5. Pipeline stages table (customizable per tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key VARCHAR(50) NOT NULL,
  label VARCHAR(100) NOT NULL,
  color VARCHAR(50) NOT NULL DEFAULT 'oklch(0.72 0.19 250)',
  position INT NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, key)
);

-- ============================================================
-- 6. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_contacts_lead ON contacts(lead_id);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activities_lead ON activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_tenant ON activities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
CREATE INDEX IF NOT EXISTS idx_tasks_lead ON tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant ON tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date) WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_tenant ON pipeline_stages(tenant_id, position);
CREATE INDEX IF NOT EXISTS idx_leads_deleted ON leads(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_last_contact ON leads(last_contact_at);
CREATE INDEX IF NOT EXISTS idx_leads_next_followup ON leads(next_follow_up) WHERE next_follow_up IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source) WHERE source IS NOT NULL;

-- ============================================================
-- 7. Lead summary view
-- ============================================================
CREATE OR REPLACE VIEW lead_summary_view AS
SELECT
  l.id,
  l.tenant_id,
  l.stage,
  l.priority,
  l.estimated_value,
  l.actual_value,
  l.source,
  l.tags,
  l.address,
  l.city,
  l.hail_size_in,
  l.insurance_company,
  l.contact_name,
  l.contact_phone,
  l.contact_email,
  l.last_contact_at,
  l.next_follow_up,
  l.notes,
  l.lost_reason,
  l.created_at,
  l.updated_at,
  l.deleted_at,
  l.property_id,
  l.storm_event_id,
  l.assigned_rep_id,
  -- Primary contact
  pc.first_name AS contact_first_name,
  pc.last_name AS contact_last_name,
  pc.phone AS primary_phone,
  pc.email AS primary_email,
  -- Assigned user
  u.first_name AS rep_first_name,
  u.last_name AS rep_last_name,
  u.email AS rep_email,
  -- Property
  p.roof_type,
  p.roof_sqft,
  p.year_built,
  p.assessed_value AS property_value,
  p.address_line1 AS property_address,
  -- Storm
  se.hail_size_max_in AS storm_hail_max,
  se.wind_speed_max_mph AS storm_wind_max,
  se.event_start AS storm_date,
  -- Latest activity
  la.latest_activity_at,
  la.latest_activity_type
FROM leads l
LEFT JOIN LATERAL (
  SELECT first_name, last_name, phone, email
  FROM contacts
  WHERE contacts.lead_id = l.id AND contacts.is_primary = true
  LIMIT 1
) pc ON true
LEFT JOIN users u ON u.id = l.assigned_rep_id
LEFT JOIN properties p ON p.id = l.property_id
LEFT JOIN storm_events se ON se.id = l.storm_event_id
LEFT JOIN LATERAL (
  SELECT created_at AS latest_activity_at, type AS latest_activity_type
  FROM activities
  WHERE activities.lead_id = l.id
  ORDER BY created_at DESC
  LIMIT 1
) la ON true;

-- ============================================================
-- 8. Seed default pipeline stages for existing tenants
-- ============================================================
INSERT INTO pipeline_stages (tenant_id, key, label, color, position)
SELECT t.id, s.key, s.label, s.color, s.position
FROM tenants t
CROSS JOIN (VALUES
  ('new',           'New',            'oklch(0.72 0.19 250)', 0),
  ('contacted',     'Contacted',      'oklch(0.75 0.15 200)', 1),
  ('appt_set',      'Appt Set',       'oklch(0.78 0.17 85)',  2),
  ('inspected',     'Inspected',      'oklch(0.72 0.20 50)',  3),
  ('estimate_sent', 'Estimate Sent',  'oklch(0.70 0.18 330)', 4),
  ('sold',          'Sold',           'oklch(0.75 0.18 155)', 6),
  ('lost',          'Lost',           'oklch(0.55 0.05 260)', 8),
  ('on_hold',       'On Hold',        'oklch(0.60 0.08 260)', 9)
) AS s(key, label, color, position)
ON CONFLICT (tenant_id, key) DO NOTHING;

-- ============================================================
-- 9. Updated_at triggers for new tables
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contacts_updated_at ON contacts;
CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
