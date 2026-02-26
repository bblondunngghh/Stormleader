-- County Data Sources registry for multi-county ArcGIS import
-- Tracks ArcGIS REST endpoints and field mappings per county

CREATE TABLE IF NOT EXISTS county_data_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  county_name VARCHAR(100) NOT NULL,
  state VARCHAR(2) DEFAULT 'TX',
  fips_code VARCHAR(5),
  arcgis_url TEXT NOT NULL,
  field_map JSONB NOT NULL,
  geometry_type VARCHAR(20) DEFAULT 'polygon',
  data_source_tag VARCHAR(50) NOT NULL,
  last_imported_at TIMESTAMPTZ,
  total_records INT DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  bbox GEOMETRY(POLYGON, 4326),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(county_name, state)
);

CREATE INDEX IF NOT EXISTS idx_county_data_sources_bbox ON county_data_sources USING GIST (bbox);

-- Add county column to properties
ALTER TABLE properties ADD COLUMN IF NOT EXISTS county VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_properties_county ON properties(county);

-- Seed confirmed free ArcGIS endpoints for 5 TX counties
INSERT INTO county_data_sources (county_name, state, fips_code, arcgis_url, field_map, geometry_type, data_source_tag, bbox)
VALUES
  (
    'Travis', 'TX', '48453',
    'https://gis.traviscountytx.gov/server1/rest/services/Boundaries_and_Jurisdictions/TCAD_public/MapServer/0/query',
    '{
      "parcel_id": "PROP_ID",
      "address": "situs_address",
      "address_num": "situs_num",
      "street_prefix": "situs_street_prefx",
      "street": "situs_street",
      "street_suffix": "situs_street_suffix",
      "city": "situs_city",
      "zip": "situs_zip",
      "owner_name": null,
      "year_built": null,
      "assessed_value": null
    }'::jsonb,
    'polygon',
    'tcad_gis',
    ST_MakeEnvelope(-98.17, 30.07, -97.37, 30.63, 4326)
  ),
  (
    'Harris', 'TX', '48201',
    'https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0/query',
    '{
      "parcel_id": "HCAD_NUM",
      "address": "SITE_ADDR",
      "address_num": "SITE_ADDR_NUM",
      "street_prefix": "SITE_ADDR_PRE_DIR",
      "street": "SITE_ADDR_STREET",
      "street_suffix": "SITE_ADDR_SUFFIX",
      "city": "SITE_ADDR_CITY",
      "zip": "SITE_ADDR_ZIP",
      "owner_name": "OWNER",
      "year_built": "YEAR_BUILT",
      "assessed_value": "TOTAL_APPRAISED_VALUE"
    }'::jsonb,
    'polygon',
    'hcad_gis',
    ST_MakeEnvelope(-95.91, 29.50, -94.91, 30.18, 4326)
  ),
  (
    'Bexar', 'TX', '48029',
    'https://maps.bexar.org/arcgis/rest/services/Parcels/MapServer/0/query',
    '{
      "parcel_id": "PROP_ID",
      "address": "SITUS",
      "address_num": null,
      "street_prefix": null,
      "street": null,
      "street_suffix": null,
      "city": "SITUS_CITY",
      "zip": "SITUS_ZIP",
      "owner_name": "OWNER_NAME",
      "year_built": "YEAR_BUILT",
      "assessed_value": "TOTAL_VALUE"
    }'::jsonb,
    'polygon',
    'bcad_gis',
    ST_MakeEnvelope(-98.81, 29.17, -98.21, 29.74, 4326)
  ),
  (
    'Williamson', 'TX', '48491',
    'https://gis.wilco.org/arcgis/rest/services/public/county_wcad_parcels/MapServer/0/query',
    '{
      "parcel_id": "GEO_ID",
      "address": "SITUS_ADDR",
      "address_num": null,
      "street_prefix": null,
      "street": null,
      "street_suffix": null,
      "city": "SITUS_CITY",
      "zip": "SITUS_ZIP",
      "owner_name": "OWNER_NAME",
      "year_built": null,
      "assessed_value": "TOTAL_VALUE"
    }'::jsonb,
    'polygon',
    'wcad_gis',
    ST_MakeEnvelope(-98.05, 30.49, -97.15, 31.08, 4326)
  ),
  (
    'Hays', 'TX', '48209',
    'https://gis.urbaneng.com/arcgis/rest/services/HaysCountyParcels/FeatureServer/0/query',
    '{
      "parcel_id": "PROP_ID",
      "address": "SITUS",
      "address_num": null,
      "street_prefix": null,
      "street": null,
      "street_suffix": null,
      "city": "SITUS_CITY",
      "zip": "SITUS_ZIP",
      "owner_name": "OWNER_NAME",
      "year_built": null,
      "assessed_value": "ASSESSED_VALUE"
    }'::jsonb,
    'polygon',
    'hcad_hays_gis',
    ST_MakeEnvelope(-98.31, 29.81, -97.71, 30.26, 4326)
  )
ON CONFLICT (county_name, state) DO NOTHING;

-- Statewide Texas parcel source from TNRIS (covers all 254 counties)
INSERT INTO county_data_sources (county_name, state, fips_code, arcgis_url, field_map, geometry_type, data_source_tag, bbox)
VALUES (
  '_TX_STATEWIDE', 'TX', '48',
  'https://feature.tnris.org/arcgis/rest/services/Parcels/stratmap25_land_parcels_48/MapServer/0/query',
  '{
    "parcel_id": "prop_id",
    "geo_id": "geo_id",
    "address": "situs_addr",
    "address_num": "situs_num",
    "street_prefix": "situs_stre",
    "street": "situs_st_1",
    "street_suffix": "situs_st_2",
    "city": "situs_city",
    "zip": "situs_zip",
    "owner_name": "owner_name",
    "year_built": "year_built",
    "assessed_value": "mkt_value",
    "county_field": "county",
    "fips_field": "fips"
  }'::jsonb,
  'polygon',
  'tnris_statewide',
  ST_MakeEnvelope(-106.65, 25.84, -93.51, 36.50, 4326)
)
ON CONFLICT (county_name, state) DO NOTHING;
