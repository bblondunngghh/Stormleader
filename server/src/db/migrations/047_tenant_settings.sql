-- Tenant-level settings key-value store
CREATE TABLE IF NOT EXISTS tenant_settings (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key VARCHAR(100) NOT NULL,
  value TEXT,
  PRIMARY KEY (tenant_id, key)
);
