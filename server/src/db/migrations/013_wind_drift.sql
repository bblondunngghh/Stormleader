-- Wind drift correction: store corrected geometry alongside the original
ALTER TABLE storm_events
  ADD COLUMN IF NOT EXISTS drift_corrected_geom GEOMETRY(GEOMETRY, 4326),
  ADD COLUMN IF NOT EXISTS drift_vector_m JSONB; -- { dx_m, dy_m, fall_time_s, detection_alt_m }

-- Ground-truth feedback for calibration
CREATE TABLE drift_calibrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  storm_event_id UUID NOT NULL REFERENCES storm_events(id) ON DELETE CASCADE,
  actual_damage_location GEOMETRY(POINT, 4326) NOT NULL,
  predicted_location GEOMETRY(POINT, 4326),
  offset_meters NUMERIC(8,1),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_drift_calibrations_tenant ON drift_calibrations(tenant_id);
CREATE INDEX idx_drift_calibrations_storm ON drift_calibrations(storm_event_id);
CREATE INDEX idx_storm_events_drift_geom ON storm_events USING GIST (drift_corrected_geom)
  WHERE drift_corrected_geom IS NOT NULL;
