-- Track when a tenant last changed their subscription plan
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan_changed_at TIMESTAMPTZ;
