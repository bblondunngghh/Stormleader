-- 051_lead_summary_view_tenant_scope.sql
--
-- 31ed5f0 added `AND u.tenant_id = ...` to every `LEFT JOIN users` in the JS query
-- strings, but lead_summary_view holds one more copy of the same join INSIDE the
-- database, and it was missed. getLeads() (crmService.js:69) — the /leads list — reads
-- rep_first_name / rep_last_name / rep_email straight out of this view, so a lead
-- carrying another tenant's assigned_rep_id still resolved that tenant's user here.
--
-- The primary-contact LATERAL has the same shape: it matched on lead_id alone, so a
-- contact row belonging to another tenant would have supplied contact_first_name,
-- contact_last_name, primary_phone and primary_email.
--
-- properties is deliberately left unscoped — it has no tenant_id column; storm
-- property data is shared across tenants by design.
--
-- Column list is byte-identical to the previous definition (042 + 033); only the two
-- ON/WHERE clauses change.

DROP VIEW IF EXISTS lead_summary_view;

CREATE VIEW lead_summary_view AS
SELECT
  l.id, l.tenant_id, l.stage, l.priority, l.estimated_value, l.actual_value,
  l.source, l.tags, l.address, l.city, l.hail_size_in, l.insurance_company,
  l.contact_name, l.contact_phone, l.contact_email,
  l.last_contact_at, l.next_follow_up, l.notes, l.lost_reason,
  l.created_at, l.updated_at, l.deleted_at,
  l.property_id, l.storm_event_id, l.assigned_rep_id,
  l.custom_fields, l.lead_score, l.lead_score_factors, l.lead_score_updated_at,
  pc.first_name AS contact_first_name, pc.last_name AS contact_last_name,
  pc.phone AS primary_phone, pc.email AS primary_email,
  u.first_name AS rep_first_name, u.last_name AS rep_last_name, u.email AS rep_email,
  p.roof_type, p.roof_sqft, p.year_built, p.assessed_value
FROM leads l
LEFT JOIN LATERAL (
  SELECT contacts.first_name, contacts.last_name, contacts.phone, contacts.email
  FROM contacts
  WHERE contacts.lead_id = l.id
    AND contacts.tenant_id = l.tenant_id
    AND contacts.is_primary = true
  LIMIT 1
) pc ON true
LEFT JOIN users u ON u.id = l.assigned_rep_id AND u.tenant_id = l.tenant_id
LEFT JOIN properties p ON p.id = l.property_id;
