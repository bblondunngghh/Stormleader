-- Custom field definitions (tenant-scoped)
CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type VARCHAR(20) NOT NULL DEFAULT 'lead',
  field_key VARCHAR(50) NOT NULL,
  field_label VARCHAR(100) NOT NULL,
  field_type VARCHAR(20) NOT NULL DEFAULT 'text',
  options JSONB,
  sort_order INTEGER DEFAULT 0,
  is_required BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, entity_type, field_key)
);

-- Add custom_fields JSONB column to leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';

-- Update lead_summary_view to include custom_fields
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
