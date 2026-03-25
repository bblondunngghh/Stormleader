-- 043_security_audit_indexes.sql
-- Missing indexes identified during 2026-03-25 security & performance audit

-- properties: tenant_id used in nearly every property query
CREATE INDEX IF NOT EXISTS idx_properties_tenant ON properties(tenant_id);

-- leads: property_id used in JOINs with properties table
CREATE INDEX IF NOT EXISTS idx_leads_property ON leads(property_id);

-- leads: soft-delete filter used in every tenant query
CREATE INDEX IF NOT EXISTS idx_leads_tenant_deleted ON leads(tenant_id, deleted_at);

-- contacts: primary contact lookup pattern
CREATE INDEX IF NOT EXISTS idx_contacts_lead_primary ON contacts(lead_id, is_primary);

-- drip_enrollments: lead-based lookups and duplicate checks
CREATE INDEX IF NOT EXISTS idx_drip_enrollments_lead ON drip_enrollments(lead_id);
CREATE INDEX IF NOT EXISTS idx_drip_enrollments_seq_lead ON drip_enrollments(sequence_id, lead_id, status);

-- drip_sequence_steps: step ordering within a sequence
CREATE INDEX IF NOT EXISTS idx_drip_steps_seq_order ON drip_sequence_steps(sequence_id, step_order);
