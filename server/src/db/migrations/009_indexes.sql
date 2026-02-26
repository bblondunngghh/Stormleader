-- GIST indexes only work with PostGIS geometry columns
DO $$
BEGIN
  IF has_postgis() THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_storm_events_geom ON storm_events USING GIST(geom)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_storm_events_bbox ON storm_events USING GIST(bbox)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_properties_location ON properties USING GIST(location)';
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_storm_events_start ON storm_events(event_start DESC);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_stage ON leads(tenant_id, stage);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_priority ON leads(tenant_id, priority);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_created ON leads(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_lead ON outreach_log(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

-- Auto-update updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_properties_updated BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
