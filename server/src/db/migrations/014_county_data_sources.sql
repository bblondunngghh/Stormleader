-- County Data Sources registry for multi-county ArcGIS import
DO $$
BEGIN
  IF has_postgis() THEN
    EXECUTE '
      CREATE TABLE IF NOT EXISTS county_data_sources (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        county_name VARCHAR(100) NOT NULL,
        state VARCHAR(2) DEFAULT ''TX'',
        fips_code VARCHAR(5),
        arcgis_url TEXT NOT NULL,
        field_map JSONB NOT NULL,
        geometry_type VARCHAR(20) DEFAULT ''polygon'',
        data_source_tag VARCHAR(50) NOT NULL,
        last_imported_at TIMESTAMPTZ,
        total_records INT DEFAULT 0,
        enabled BOOLEAN DEFAULT true,
        bbox GEOMETRY(POLYGON, 4326),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(county_name, state)
      )';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_county_data_sources_bbox ON county_data_sources USING GIST (bbox)';
  ELSE
    EXECUTE '
      CREATE TABLE IF NOT EXISTS county_data_sources (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        county_name VARCHAR(100) NOT NULL,
        state VARCHAR(2) DEFAULT ''TX'',
        fips_code VARCHAR(5),
        arcgis_url TEXT NOT NULL,
        field_map JSONB NOT NULL,
        geometry_type VARCHAR(20) DEFAULT ''polygon'',
        data_source_tag VARCHAR(50) NOT NULL,
        last_imported_at TIMESTAMPTZ,
        total_records INT DEFAULT 0,
        enabled BOOLEAN DEFAULT true,
        bbox TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(county_name, state)
      )';
  END IF;
END
$$;

-- Add county column to properties
ALTER TABLE properties ADD COLUMN IF NOT EXISTS county VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_properties_county ON properties(county);

-- Seed county data sources (skip bbox geometry if no PostGIS)
DO $$
BEGIN
  IF has_postgis() THEN
    INSERT INTO county_data_sources (county_name, state, fips_code, arcgis_url, field_map, geometry_type, data_source_tag, bbox)
    VALUES
      ('Travis', 'TX', '48453', 'https://gis.traviscountytx.gov/server1/rest/services/Boundaries_and_Jurisdictions/TCAD_public/MapServer/0/query',
       '{"parcel_id":"PROP_ID","address":"situs_address","city":"situs_city","zip":"situs_zip"}'::jsonb,
       'polygon', 'tcad_gis', ST_MakeEnvelope(-98.17, 30.07, -97.37, 30.63, 4326)),
      ('Harris', 'TX', '48201', 'https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0/query',
       '{"parcel_id":"HCAD_NUM","address":"SITE_ADDR","city":"SITE_ADDR_CITY","zip":"SITE_ADDR_ZIP"}'::jsonb,
       'polygon', 'hcad_gis', ST_MakeEnvelope(-95.91, 29.50, -94.91, 30.18, 4326)),
      ('Bexar', 'TX', '48029', 'https://maps.bexar.org/arcgis/rest/services/Parcels/MapServer/0/query',
       '{"parcel_id":"PROP_ID","address":"SITUS","city":"SITUS_CITY","zip":"SITUS_ZIP"}'::jsonb,
       'polygon', 'bcad_gis', ST_MakeEnvelope(-98.81, 29.17, -98.21, 29.74, 4326)),
      ('Williamson', 'TX', '48491', 'https://gis.wilco.org/arcgis/rest/services/public/county_wcad_parcels/MapServer/0/query',
       '{"parcel_id":"GEO_ID","address":"SITUS_ADDR","city":"SITUS_CITY","zip":"SITUS_ZIP"}'::jsonb,
       'polygon', 'wcad_gis', ST_MakeEnvelope(-98.05, 30.49, -97.15, 31.08, 4326)),
      ('Hays', 'TX', '48209', 'https://gis.urbaneng.com/arcgis/rest/services/HaysCountyParcels/FeatureServer/0/query',
       '{"parcel_id":"PROP_ID","address":"SITUS","city":"SITUS_CITY","zip":"SITUS_ZIP"}'::jsonb,
       'polygon', 'hcad_hays_gis', ST_MakeEnvelope(-98.31, 29.81, -97.71, 30.26, 4326)),
      ('_TX_STATEWIDE', 'TX', '48', 'https://feature.tnris.org/arcgis/rest/services/Parcels/stratmap25_land_parcels_48/MapServer/0/query',
       '{"parcel_id":"prop_id","address":"situs_addr","city":"situs_city","zip":"situs_zip"}'::jsonb,
       'polygon', 'tnris_statewide', ST_MakeEnvelope(-106.65, 25.84, -93.51, 36.50, 4326))
    ON CONFLICT (county_name, state) DO NOTHING;
  ELSE
    INSERT INTO county_data_sources (county_name, state, fips_code, arcgis_url, field_map, geometry_type, data_source_tag)
    VALUES
      ('Travis', 'TX', '48453', 'https://gis.traviscountytx.gov/server1/rest/services/Boundaries_and_Jurisdictions/TCAD_public/MapServer/0/query',
       '{"parcel_id":"PROP_ID","address":"situs_address","city":"situs_city","zip":"situs_zip"}'::jsonb, 'polygon', 'tcad_gis'),
      ('Harris', 'TX', '48201', 'https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0/query',
       '{"parcel_id":"HCAD_NUM","address":"SITE_ADDR","city":"SITE_ADDR_CITY","zip":"SITE_ADDR_ZIP"}'::jsonb, 'polygon', 'hcad_gis'),
      ('Bexar', 'TX', '48029', 'https://maps.bexar.org/arcgis/rest/services/Parcels/MapServer/0/query',
       '{"parcel_id":"PROP_ID","address":"SITUS","city":"SITUS_CITY","zip":"SITUS_ZIP"}'::jsonb, 'polygon', 'bcad_gis'),
      ('Williamson', 'TX', '48491', 'https://gis.wilco.org/arcgis/rest/services/public/county_wcad_parcels/MapServer/0/query',
       '{"parcel_id":"GEO_ID","address":"SITUS_ADDR","city":"SITUS_CITY","zip":"SITUS_ZIP"}'::jsonb, 'polygon', 'wcad_gis'),
      ('Hays', 'TX', '48209', 'https://gis.urbaneng.com/arcgis/rest/services/HaysCountyParcels/FeatureServer/0/query',
       '{"parcel_id":"PROP_ID","address":"SITUS","city":"SITUS_CITY","zip":"SITUS_ZIP"}'::jsonb, 'polygon', 'hcad_hays_gis'),
      ('_TX_STATEWIDE', 'TX', '48', 'https://feature.tnris.org/arcgis/rest/services/Parcels/stratmap25_land_parcels_48/MapServer/0/query',
       '{"parcel_id":"prop_id","address":"situs_addr","city":"situs_city","zip":"situs_zip"}'::jsonb, 'polygon', 'tnris_statewide')
    ON CONFLICT (county_name, state) DO NOTHING;
  END IF;
END
$$;
