-- Add batch billing columns to skip_trace_usage
ALTER TABLE skip_trace_usage ADD COLUMN IF NOT EXISTS billed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE skip_trace_usage ADD COLUMN IF NOT EXISTS invoice_id TEXT;

-- Track billing invoices
CREATE TABLE IF NOT EXISTS skip_trace_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT,
  total_records INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, failed
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skip_trace_invoices_tenant ON skip_trace_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_skip_trace_usage_billed ON skip_trace_usage(tenant_id, billed) WHERE billed = false;
