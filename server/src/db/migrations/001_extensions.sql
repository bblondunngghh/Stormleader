-- Try to enable PostGIS; if unavailable, geo columns will use TEXT fallback
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS "postgis";
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'PostGIS not available — geo columns will use TEXT type.';
END
$$;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Helper function: returns true if PostGIS is installed
CREATE OR REPLACE FUNCTION has_postgis() RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis');
END;
$$ LANGUAGE plpgsql;
