-- Add missing tenant_id indexes for query performance and tenant isolation
CREATE INDEX IF NOT EXISTS idx_client_status_tokens_tenant ON client_status_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contract_templates_tenant ON contract_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_drip_sequences_tenant ON drip_sequences(tenant_id);
CREATE INDEX IF NOT EXISTS idx_outreach_log_tenant ON outreach_log(tenant_id);
