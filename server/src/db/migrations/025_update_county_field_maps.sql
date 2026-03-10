-- Update county data source field maps with correct ArcGIS field names
-- Also fixes original base field names that were incorrect

-- Harris County: fix address fields (split into components), add value/owner/sqft
UPDATE county_data_sources
SET field_map = '{"parcel_id":"HCAD_NUM","address_num":"site_str_num","street":"site_str_name","street_suffix":"site_str_sfx","street_prefix":"site_str_pfx","city":"site_city","zip":"site_zip","assessed_value":"total_appraised_val","owner_name":"owner_name_1","property_sqft":"land_sqft"}'::jsonb
WHERE county_name = 'Harris' AND state = 'TX';

-- Bexar County: fix address/city/zip field names, add value/owner/year/sqft
UPDATE county_data_sources
SET field_map = '{"parcel_id":"PropID","address":"Situs","city":"AddrCity","zip":"Zip","assessed_value":"TotVal","owner_name":"Owner","year_built":"YrBlt","property_sqft":"GBA"}'::jsonb
WHERE county_name = 'Bexar' AND state = 'TX';

-- Williamson County: replace entire field map with correct names
UPDATE county_data_sources
SET field_map = '{"parcel_id":"GEO_ID","address":"SitusAddress","city":"Scity","zip":"Szip","assessed_value":"TotalAssessedValue","owner_name":"FullName","year_built":"RESYRBLT","property_sqft":"TotalSqFtLivingArea"}'::jsonb
WHERE county_name = 'Williamson' AND state = 'TX';

-- TX Statewide (TNRIS): add value/owner/year fields
UPDATE county_data_sources
SET field_map = jsonb_set(
  jsonb_set(
    jsonb_set(
      field_map,
      '{assessed_value}', '"mkt_value"'
    ),
    '{owner_name}', '"owner_name"'
  ),
  '{year_built}', '"year_built"'
)
WHERE county_name = '_TX_STATEWIDE' AND state = 'TX';
