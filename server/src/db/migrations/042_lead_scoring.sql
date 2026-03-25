-- Lead scoring: computed score based on storm damage, property value, activity recency
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_score INTEGER;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_score_factors JSONB;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_score_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leads_lead_score ON leads (tenant_id, lead_score DESC NULLS LAST) WHERE deleted_at IS NULL;

-- Recreate lead_summary_view with lead_score columns
DROP VIEW IF EXISTS lead_summary_view;
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
  l.custom_fields,
  l.lead_score,
  l.lead_score_factors,
  l.lead_score_updated_at,
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
  p.assessed_value
FROM leads l
LEFT JOIN LATERAL (
  SELECT first_name, last_name, phone, email
  FROM contacts
  WHERE lead_id = l.id AND is_primary = true
  LIMIT 1
) pc ON true
LEFT JOIN users u ON u.id = l.assigned_rep_id
LEFT JOIN properties p ON p.id = l.property_id;
