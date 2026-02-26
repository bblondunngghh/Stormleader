import pool from '../db/pool.js';
import logger from '../utils/logger.js';

/**
 * Find all properties that fall within a storm event's swath polygon.
 * Returns properties with distance (meters) from the swath centroid.
 */
export async function findPropertiesInSwath(stormEventId, options = {}) {
  const { limit = 500, offset = 0 } = options;

  const { rows } = await pool.query(
    `SELECT
        p.id, p.address_line1, p.address_line2, p.city, p.state, p.zip,
        p.owner_first_name, p.owner_last_name, p.owner_phone, p.owner_email,
        p.roof_type, p.roof_sqft, p.year_built, p.assessed_value,
        p.homestead_exempt, p.county_parcel_id, p.property_sqft, p.data_source,
        ST_AsGeoJSON(p.location)::json AS geometry,
        ST_Distance(
          p.location::geography,
          ST_Centroid(se.geom)::geography
        ) AS distance_m
     FROM properties p
     JOIN storm_events se ON se.id = $1
     WHERE ST_Intersects(p.location, se.geom)
     ORDER BY distance_m ASC
     LIMIT $2 OFFSET $3`,
    [stormEventId, limit, offset]
  );

  return {
    type: 'FeatureCollection',
    features: rows.map((r) => ({
      type: 'Feature',
      id: r.id,
      geometry: r.geometry,
      properties: {
        address_line1: r.address_line1,
        address_line2: r.address_line2,
        city: r.city,
        state: r.state,
        zip: r.zip,
        owner_first_name: r.owner_first_name,
        owner_last_name: r.owner_last_name,
        owner_phone: r.owner_phone,
        owner_email: r.owner_email,
        roof_type: r.roof_type,
        roof_sqft: r.roof_sqft,
        year_built: r.year_built,
        assessed_value: r.assessed_value,
        homestead_exempt: r.homestead_exempt,
        county_parcel_id: r.county_parcel_id,
        property_sqft: r.property_sqft,
        data_source: r.data_source,
        distance_m: parseFloat(r.distance_m),
      },
    })),
  };
}

/**
 * Get properties within a map viewport bounding box.
 */
export async function getPropertiesInViewport(bbox, limit = 1000) {
  const [west, south, east, north] = bbox;

  const { rows } = await pool.query(
    `SELECT
        id, address_line1, address_line2, city, state, zip,
        owner_first_name, owner_last_name,
        roof_type, roof_sqft, year_built, assessed_value,
        homestead_exempt, county_parcel_id, property_sqft, data_source,
        ST_AsGeoJSON(location)::json AS geometry
     FROM properties
     WHERE ST_Intersects(location, ST_MakeEnvelope($1, $2, $3, $4, 4326))
     LIMIT $5`,
    [west, south, east, north, limit]
  );

  return formatPropertyCollection(rows);
}

/**
 * Get properties that fall inside any storm event geometry within the viewport + time range.
 * Only returns properties that are actually in a storm-affected area.
 */
export async function getPropertiesInStormZones(bbox, timeRange, limit = 5000) {
  const [west, south, east, north] = bbox;
  const params = [west, south, east, north];

  let timeFilter = '';
  if (timeRange && timeRange !== 'all') {
    const intervals = { '24h': '24 hours', '7d': '7 days', '30d': '30 days' };
    const interval = intervals[timeRange];
    if (interval) {
      timeFilter = `AND se.event_start >= NOW() - INTERVAL '${interval}'`;
    }
  }

  params.push(limit);

  const { rows } = await pool.query(
    `SELECT DISTINCT ON (p.id)
        p.id, p.address_line1, p.address_line2, p.city, p.state, p.zip,
        p.owner_first_name, p.owner_last_name,
        p.roof_type, p.roof_sqft, p.year_built, p.assessed_value,
        p.homestead_exempt, p.county_parcel_id, p.property_sqft, p.data_source,
        ST_AsGeoJSON(p.location)::json AS geometry,
        se.hail_size_max_in AS storm_hail_size,
        se.wind_speed_max_mph AS storm_wind_speed,
        se.raw_data->>'type' AS storm_type
     FROM properties p
     JOIN storm_events se ON ST_Intersects(p.location, COALESCE(se.drift_corrected_geom, se.geom))
     WHERE ST_Intersects(se.geom, ST_MakeEnvelope($1, $2, $3, $4, 4326))
     ${timeFilter}
     ORDER BY p.id, se.hail_size_max_in DESC NULLS LAST
     LIMIT $5`,
    params
  );

  return {
    type: 'FeatureCollection',
    features: rows.map((r) => ({
      type: 'Feature',
      id: r.id,
      geometry: r.geometry,
      properties: {
        address_line1: r.address_line1,
        address_line2: r.address_line2,
        city: r.city,
        state: r.state,
        zip: r.zip,
        owner_first_name: r.owner_first_name,
        owner_last_name: r.owner_last_name,
        roof_type: r.roof_type,
        roof_sqft: r.roof_sqft,
        year_built: r.year_built,
        assessed_value: r.assessed_value,
        homestead_exempt: r.homestead_exempt,
        county_parcel_id: r.county_parcel_id,
        property_sqft: r.property_sqft,
        data_source: r.data_source,
        storm_hail_size: r.storm_hail_size,
        storm_wind_speed: r.storm_wind_speed,
        storm_type: r.storm_type,
      },
    })),
  };
}

function formatPropertyCollection(rows) {
  return {
    type: 'FeatureCollection',
    features: rows.map((r) => ({
      type: 'Feature',
      id: r.id,
      geometry: r.geometry,
      properties: {
        address_line1: r.address_line1,
        address_line2: r.address_line2,
        city: r.city,
        state: r.state,
        zip: r.zip,
        owner_first_name: r.owner_first_name,
        owner_last_name: r.owner_last_name,
        roof_type: r.roof_type,
        roof_sqft: r.roof_sqft,
        year_built: r.year_built,
        assessed_value: r.assessed_value,
        homestead_exempt: r.homestead_exempt,
        county_parcel_id: r.county_parcel_id,
        property_sqft: r.property_sqft,
        data_source: r.data_source,
      },
    })),
  };
}

/**
 * Bulk import properties (e.g. from TCAD data).
 * Expects array of objects with: address_line1, city, state, zip, lng, lat, and optional fields.
 */
export async function importProperties(properties) {
  const client = await pool.connect();
  let inserted = 0;

  try {
    await client.query('BEGIN');

    for (const p of properties) {
      await client.query(
        `INSERT INTO properties (
          location, address_line1, address_line2, city, state, zip,
          owner_first_name, owner_last_name, owner_phone, owner_email,
          roof_type, roof_sqft, year_built, assessed_value,
          homestead_exempt, county_parcel_id, property_sqft, data_source
        ) VALUES (
          ST_SetSRID(ST_MakePoint($1, $2), 4326),
          $3, $4, $5, $6, $7,
          $8, $9, $10, $11,
          $12, $13, $14, $15,
          $16, $17, $18, $19
        )`,
        [
          p.lng, p.lat,
          p.address_line1 || null, p.address_line2 || null,
          p.city || null, p.state || 'TX', p.zip || null,
          p.owner_first_name || null, p.owner_last_name || null,
          p.owner_phone || null, p.owner_email || null,
          p.roof_type || null, p.roof_sqft || null,
          p.year_built || null, p.assessed_value || null,
          p.homestead_exempt || false, p.county_parcel_id || null,
          p.property_sqft || null, p.data_source || null,
        ]
      );
      inserted++;
    }

    await client.query('COMMIT');
    logger.info(`Imported ${inserted} properties`);
    return { inserted };
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ err }, 'Property import failed');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get a single property by ID.
 */
export async function getProperty(id) {
  const { rows } = await pool.query(
    `SELECT
        id, address_line1, address_line2, city, state, zip,
        owner_first_name, owner_last_name, owner_phone, owner_email,
        roof_type, roof_sqft, year_built, assessed_value,
        homestead_exempt, county_parcel_id, property_sqft, data_source,
        ST_AsGeoJSON(location)::json AS geometry,
        created_at, updated_at
     FROM properties
     WHERE id = $1`,
    [id]
  );

  if (rows.length === 0) return null;

  const r = rows[0];
  return {
    type: 'Feature',
    id: r.id,
    geometry: r.geometry,
    properties: {
      address_line1: r.address_line1,
      address_line2: r.address_line2,
      city: r.city,
      state: r.state,
      zip: r.zip,
      owner_first_name: r.owner_first_name,
      owner_last_name: r.owner_last_name,
      owner_phone: r.owner_phone,
      owner_email: r.owner_email,
      roof_type: r.roof_type,
      roof_sqft: r.roof_sqft,
      year_built: r.year_built,
      assessed_value: r.assessed_value,
      homestead_exempt: r.homestead_exempt,
      county_parcel_id: r.county_parcel_id,
      property_sqft: r.property_sqft,
      data_source: r.data_source,
      created_at: r.created_at,
      updated_at: r.updated_at,
    },
  };
}
