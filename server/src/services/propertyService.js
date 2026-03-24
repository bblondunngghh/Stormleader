import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import cache from '../utils/cache.js';

// Texas bounding box
const TX_BOUNDS = { west: -106.65, south: 25.84, east: -93.51, north: 36.50 };
function clampToTexas(bbox) {
  const [w, s, e, n] = [
    Math.max(bbox[0], TX_BOUNDS.west), Math.max(bbox[1], TX_BOUNDS.south),
    Math.min(bbox[2], TX_BOUNDS.east), Math.min(bbox[3], TX_BOUNDS.north),
  ];
  return (w >= e || s >= n) ? null : [w, s, e, n];
}

/**
 * Find all properties that fall within a storm event's swath polygon.
 * Returns properties with distance (meters) from the swath centroid.
 */
export async function findPropertiesInSwath(stormEventId, options = {}) {
  const { limit = 500, offset = 0, bbox } = options;

  // Check cache — 5-minute TTL
  const cacheKey = `props-swath:${stormEventId}:${bbox ? bbox.join(',') : ''}:${limit}:${offset}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // If bbox provided, intersect with viewport for incremental loading
  const bboxFilter = bbox
    ? `AND p.location && ST_MakeEnvelope($4, $5, $6, $7, 4326)`
    : '';
  const params = bbox
    ? [stormEventId, limit, offset, bbox[0], bbox[1], bbox[2], bbox[3]]
    : [stormEventId, limit, offset];

  const { rows } = await pool.query(
    `SELECT
        p.id, p.address_line1, p.address_line2, p.city, p.state, p.zip,
        p.owner_first_name, p.owner_last_name, p.owner_phone, p.owner_email,
        p.roof_type,
        COALESCE(p.roof_sqft, p.fema_sqft) AS roof_sqft,
        COALESCE(p.year_built, p.fema_year_built) AS year_built,
        COALESCE(p.assessed_value, p.fema_replacement_value) AS assessed_value,
        p.homestead_exempt, p.county_parcel_id,
        COALESCE(p.property_sqft, p.fema_sqft) AS property_sqft,
        p.data_source,
        p.fema_occupancy_type, p.fema_bldg_type, p.fema_num_stories,
        p.fema_foundation_type, p.fema_ground_elevation,
        ST_AsGeoJSON(p.location)::json AS geometry,
        ST_Distance(
          p.location::geography,
          ST_Centroid(se.geom)::geography
        ) AS distance_m
     FROM properties p
     JOIN storm_events se ON se.id = $1
     WHERE p.location && se.geom AND ST_Intersects(p.location, se.geom)
     ${bboxFilter}
     AND (p.year_built IS NOT NULL OR p.fema_year_built IS NOT NULL OR p.roof_sqft > 0 OR p.fema_sqft > 0 OR COALESCE(p.assessed_value, p.fema_replacement_value) > 15000 OR p.homestead_exempt = true)
     AND p.address_line1 IS NOT NULL AND TRIM(p.address_line1) != '' AND p.address_line1 != '0'
     ORDER BY distance_m ASC
     LIMIT $2 OFFSET $3`,
    params
  );

  const result = {
    type: 'FeatureCollection',
    features: rows.map((r) => mapPropertyFeature(r, { distance_m: parseFloat(r.distance_m) })),
  };

  // Cache for 5 minutes
  cache.set(cacheKey, result, 5 * 60 * 1000);
  return result;
}

/**
 * Lightweight version of findPropertiesInSwath — returns only the columns needed
 * for map dots, dramatically reducing data transferred from Neon Postgres.
 */
export async function findPropertiesInSwathLight(stormEventId, options = {}) {
  const { limit = 500, offset = 0, bbox } = options;

  const cacheKey = `props-swath-light:${stormEventId}:${bbox ? bbox.join(',') : ''}:${limit}:${offset}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const bboxFilter = bbox
    ? `AND p.location && ST_MakeEnvelope($4, $5, $6, $7, 4326)`
    : '';
  const params = bbox
    ? [stormEventId, limit, offset, bbox[0], bbox[1], bbox[2], bbox[3]]
    : [stormEventId, limit, offset];

  const { rows } = await pool.query(
    `SELECT
        p.id,
        ST_AsGeoJSON(p.location)::json AS geometry,
        COALESCE(p.year_built, p.fema_year_built) AS year_built,
        p.data_source,
        COALESCE(p.assessed_value, p.fema_replacement_value) AS assessed_value,
        p.fema_bldg_type
     FROM properties p
     JOIN storm_events se ON se.id = $1
     WHERE p.location && se.geom AND ST_Intersects(p.location, se.geom)
     ${bboxFilter}
     AND (p.year_built IS NOT NULL OR p.fema_year_built IS NOT NULL OR p.roof_sqft > 0 OR p.fema_sqft > 0 OR COALESCE(p.assessed_value, p.fema_replacement_value) > 15000 OR p.homestead_exempt = true)
     AND p.address_line1 IS NOT NULL AND TRIM(p.address_line1) != '' AND p.address_line1 != '0'
     ORDER BY p.id
     LIMIT $2 OFFSET $3`,
    params
  );

  const result = {
    type: 'FeatureCollection',
    features: rows.map((r) => ({
      type: 'Feature',
      id: r.id,
      geometry: r.geometry,
      properties: {
        id: r.id,
        year_built: r.year_built,
        data_source: r.data_source,
        assessed_value: r.assessed_value,
        fema_bldg_type: r.fema_bldg_type,
      },
    })),
  };

  // Cache for 5 minutes
  cache.set(cacheKey, result, 5 * 60 * 1000);
  return result;
}

/**
 * Get properties within a map viewport bounding box.
 */
export async function getPropertiesInViewport(bbox, limit = 1000, { improvedOnly = false } = {}) {
  const clamped = clampToTexas(bbox);
  if (!clamped) return { type: 'FeatureCollection', features: [] };
  const [west, south, east, north] = clamped;

  const improvedFilter = improvedOnly ? 'AND year_built IS NOT NULL' : '';

  const { rows } = await pool.query(
    `SELECT
        id, address_line1, address_line2, city, state, zip,
        owner_first_name, owner_last_name,
        roof_type,
        COALESCE(roof_sqft, fema_sqft) AS roof_sqft,
        COALESCE(year_built, fema_year_built) AS year_built,
        COALESCE(assessed_value, fema_replacement_value) AS assessed_value,
        homestead_exempt, county_parcel_id,
        COALESCE(property_sqft, fema_sqft) AS property_sqft,
        data_source,
        fema_occupancy_type, fema_bldg_type, fema_num_stories,
        fema_foundation_type, fema_ground_elevation,
        ST_AsGeoJSON(location)::json AS geometry
     FROM properties
     WHERE ST_Intersects(location, ST_MakeEnvelope($1, $2, $3, $4, 4326))
     ${improvedFilter}
     LIMIT $5`,
    [west, south, east, north, limit]
  );

  return formatPropertyCollection(rows);
}

/**
 * Get properties that fall inside any storm event geometry within the viewport + time range.
 * Only returns properties that are actually in a storm-affected area.
 */
export async function getPropertiesInStormZones(bbox, timeRange, limit = 5000, { improvedOnly = false } = {}) {
  const clamped = clampToTexas(bbox);
  if (!clamped) return { type: 'FeatureCollection', features: [] };
  const [west, south, east, north] = clamped;
  const params = [west, south, east, north];

  let timeFilter = '';
  if (timeRange && timeRange !== 'all') {
    const intervals = { '12h': '12 hours', '24h': '24 hours', '3d': '3 days', '7d': '7 days', '14d': '14 days', '30d': '30 days' };
    const interval = intervals[timeRange];
    if (interval) {
      timeFilter = `AND se.event_start >= NOW() - INTERVAL '${interval}'`;
    }
  }

  const improvedFilter = improvedOnly ? 'AND p.year_built IS NOT NULL' : '';

  params.push(limit);

  const { rows } = await pool.query(
    `SELECT DISTINCT ON (p.id)
        p.id, p.address_line1, p.address_line2, p.city, p.state, p.zip,
        p.owner_first_name, p.owner_last_name,
        p.roof_type,
        COALESCE(p.roof_sqft, p.fema_sqft) AS roof_sqft,
        COALESCE(p.year_built, p.fema_year_built) AS year_built,
        COALESCE(p.assessed_value, p.fema_replacement_value) AS assessed_value,
        p.homestead_exempt, p.county_parcel_id,
        COALESCE(p.property_sqft, p.fema_sqft) AS property_sqft,
        p.data_source,
        p.fema_occupancy_type, p.fema_bldg_type, p.fema_num_stories,
        p.fema_foundation_type, p.fema_ground_elevation,
        ST_AsGeoJSON(p.location)::json AS geometry,
        se.id AS storm_event_id,
        se.hail_size_max_in AS storm_hail_size,
        se.wind_speed_max_mph AS storm_wind_speed,
        se.raw_data->>'type' AS storm_type,
        se.event_start AS storm_date
     FROM storm_events se
     JOIN properties p ON p.location && se.geom AND ST_Intersects(p.location, se.geom)
     WHERE se.geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)
     AND (p.fema_fd_id IS NOT NULL OR p.year_built IS NOT NULL OR p.roof_sqft > 0 OR p.homestead_exempt = true
          OR COALESCE(p.assessed_value, p.fema_replacement_value) > 15000)
     ${timeFilter}
     ORDER BY p.id, se.hail_size_max_in DESC NULLS LAST
     LIMIT $5`,
    params
  );

  return {
    type: 'FeatureCollection',
    features: rows.map((r) => mapPropertyFeature(r, {
      storm_event_id: r.storm_event_id,
      storm_hail_size: r.storm_hail_size,
      storm_wind_speed: r.storm_wind_speed,
      storm_type: r.storm_type,
      storm_date: r.storm_date,
    })),
  };
}

/**
 * Map a property row to a GeoJSON Feature with optional extra properties.
 */
function mapPropertyFeature(r, extra = {}) {
  return {
    type: 'Feature',
    id: r.id,
    geometry: r.geometry,
    properties: {
      id: r.id,
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
      fema_occupancy_type: r.fema_occupancy_type,
      fema_bldg_type: r.fema_bldg_type,
      fema_num_stories: r.fema_num_stories,
      fema_foundation_type: r.fema_foundation_type,
      fema_ground_elevation: r.fema_ground_elevation,
      ...extra,
    },
  };
}

function formatPropertyCollection(rows) {
  return {
    type: 'FeatureCollection',
    features: rows.map((r) => mapPropertyFeature(r)),
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
        roof_type,
        COALESCE(roof_sqft, fema_sqft) AS roof_sqft,
        COALESCE(year_built, fema_year_built) AS year_built,
        COALESCE(assessed_value, fema_replacement_value) AS assessed_value,
        homestead_exempt, county_parcel_id,
        COALESCE(property_sqft, fema_sqft) AS property_sqft,
        data_source,
        fema_occupancy_type, fema_bldg_type, fema_num_stories,
        fema_foundation_type, fema_foundation_height, fema_ground_elevation,
        ST_AsGeoJSON(location)::json AS geometry,
        created_at, updated_at
     FROM properties
     WHERE id = $1`,
    [id]
  );

  if (rows.length === 0) return null;

  const r = rows[0];
  return mapPropertyFeature(r, {
    fema_foundation_height: r.fema_foundation_height,
    created_at: r.created_at,
    updated_at: r.updated_at,
  });
}
