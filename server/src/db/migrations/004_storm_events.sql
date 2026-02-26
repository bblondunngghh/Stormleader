CREATE TYPE storm_source AS ENUM ('mrms_mesh', 'nws_alert', 'spc_report');

DO $$
BEGIN
  IF has_postgis() THEN
    EXECUTE '
      CREATE TABLE storm_events (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        source storm_source NOT NULL,
        source_id VARCHAR(255) NOT NULL,
        geom GEOMETRY(GEOMETRY, 4326) NOT NULL,
        bbox GEOMETRY(POLYGON, 4326),
        hail_size_max_in NUMERIC(4,2),
        wind_speed_max_mph NUMERIC(5,1),
        event_start TIMESTAMPTZ,
        event_end TIMESTAMPTZ,
        raw_data JSONB DEFAULT ''{}'',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(source, source_id)
      )';
  ELSE
    EXECUTE '
      CREATE TABLE storm_events (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        source storm_source NOT NULL,
        source_id VARCHAR(255) NOT NULL,
        geom TEXT NOT NULL,
        bbox TEXT,
        hail_size_max_in NUMERIC(4,2),
        wind_speed_max_mph NUMERIC(5,1),
        event_start TIMESTAMPTZ,
        event_end TIMESTAMPTZ,
        raw_data JSONB DEFAULT ''{}'',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(source, source_id)
      )';
  END IF;
END
$$;
