DO $$
BEGIN
  IF has_postgis() THEN
    EXECUTE '
      CREATE TABLE properties (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        location GEOMETRY(POINT, 4326),
        address_line1 VARCHAR(255),
        address_line2 VARCHAR(255),
        city VARCHAR(100),
        state VARCHAR(2) DEFAULT ''TX'',
        zip VARCHAR(10),
        owner_first_name VARCHAR(100),
        owner_last_name VARCHAR(100),
        owner_phone VARCHAR(20),
        owner_email VARCHAR(255),
        roof_type VARCHAR(50),
        roof_sqft INTEGER,
        year_built INTEGER,
        assessed_value NUMERIC(12,2),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )';
  ELSE
    EXECUTE '
      CREATE TABLE properties (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        location TEXT,
        address_line1 VARCHAR(255),
        address_line2 VARCHAR(255),
        city VARCHAR(100),
        state VARCHAR(2) DEFAULT ''TX'',
        zip VARCHAR(10),
        owner_first_name VARCHAR(100),
        owner_last_name VARCHAR(100),
        owner_phone VARCHAR(20),
        owner_email VARCHAR(255),
        roof_type VARCHAR(50),
        roof_sqft INTEGER,
        year_built INTEGER,
        assessed_value NUMERIC(12,2),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )';
  END IF;
END
$$;
