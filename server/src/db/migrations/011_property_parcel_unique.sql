-- Drop partial index if it exists (doesn't work with ON CONFLICT on PG17)
DROP INDEX IF EXISTS idx_properties_county_parcel_id;

-- Use a proper unique constraint instead
ALTER TABLE properties ADD CONSTRAINT uq_properties_county_parcel_id UNIQUE (county_parcel_id);
