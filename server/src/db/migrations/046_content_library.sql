-- Content library: persists generated content that was previously in localStorage only
CREATE TABLE IF NOT EXISTS content_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content JSONB NOT NULL,
  content_type VARCHAR(50) NOT NULL,
  tone VARCHAR(50),
  saved_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_content_library_tenant ON content_library(tenant_id, saved_at DESC);
