-- FEMA National Structure Inventory (NSI) fields on properties
-- These supplement existing county/Google Solar data without overwriting

ALTER TABLE properties ADD COLUMN IF NOT EXISTS fema_fd_id VARCHAR(50);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS fema_sqft INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS fema_year_built INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS fema_replacement_value NUMERIC(12,2);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS fema_occupancy_type VARCHAR(20);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS fema_damage_category VARCHAR(20);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS fema_bldg_type VARCHAR(5);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS fema_num_stories NUMERIC(4,1);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS fema_foundation_type VARCHAR(5);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS fema_foundation_height NUMERIC(6,2);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS fema_ground_elevation NUMERIC(10,2);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS fema_fetched_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_fema_fd_id ON properties(fema_fd_id) WHERE fema_fd_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_fema_occupancy ON properties(fema_occupancy_type) WHERE fema_occupancy_type IS NOT NULL;
