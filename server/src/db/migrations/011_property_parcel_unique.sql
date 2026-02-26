CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_county_parcel_id
  ON properties (county_parcel_id)
  WHERE county_parcel_id IS NOT NULL;
