-- Prospect lists: curated collections of properties from storm swath clicks
CREATE TABLE IF NOT EXISTS prospect_lists (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  name          TEXT NOT NULL,
  storm_event_id UUID REFERENCES storm_events(id),
  property_count INT DEFAULT 0,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_prospect_lists_tenant ON prospect_lists(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS prospect_list_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id       UUID NOT NULL REFERENCES prospect_lists(id) ON DELETE CASCADE,
  property_id   UUID NOT NULL REFERENCES properties(id),
  added_at      TIMESTAMPTZ DEFAULT now(),
  skip_traced   BOOLEAN DEFAULT false,
  skip_trace_data JSONB,
  UNIQUE(list_id, property_id)
);

CREATE INDEX idx_prospect_list_items_list ON prospect_list_items(list_id);
CREATE INDEX idx_prospect_list_items_property ON prospect_list_items(property_id);
