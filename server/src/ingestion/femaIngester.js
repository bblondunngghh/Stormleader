import pool from '../db/pool.js';
import logger from '../utils/logger.js';

const NSI_API = 'https://nsi.sec.usace.army.mil/nsiapi/structures';
const BATCH_SIZE = 2000;
const RATE_LIMIT_MS = 300;

/**
 * Query FEMA NSI structures by bounding box.
 * bbox param is a closed polygon ring of lng,lat pairs.
 */
export async function fetchByBbox(bbox) {
  const { xmin, ymin, xmax, ymax } = bbox;
  // FEMA NSI API switched to POST-only — convert bbox to polygon geometry
  const body = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[xmin, ymin], [xmin, ymax], [xmax, ymax], [xmax, ymin], [xmin, ymin]]],
      },
      properties: {},
    }],
  };

  const res = await fetch(`${NSI_API}?fmt=fc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`FEMA NSI API error: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return data.features || [];
}

/**
 * Query FEMA NSI structures by GeoJSON polygon (e.g. storm swath geometry).
 * Uses POST with GeoJSON body for complex polygons.
 */
export async function fetchByPolygon(geojson) {
  const body = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: geojson,
      properties: {},
    }],
  };

  const res = await fetch(`${NSI_API}?fmt=fc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`FEMA NSI API error: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return data.features || [];
}

/**
 * Filter to Texas residential structures only.
 */
export function filterTexasResidential(features) {
  return features.filter(f => {
    const p = f.properties;
    // Texas FIPS codes start with 48
    const fips = p.cbfips || '';
    if (!fips.startsWith('48')) return false;
    // Residential damage category or RES occupancy type
    const isResidential = p.st_damcat === 'RES' || p.st_damcat === 'Residential' ||
      (p.occtype && p.occtype.startsWith('RES'));
    return isResidential;
  });
}

/**
 * Extract FEMA fields from an NSI feature.
 */
export function extractFemaData(feature) {
  const p = feature.properties;
  const [lng, lat] = feature.geometry?.coordinates || [null, null];

  if (lng == null || lat == null || isNaN(lng) || isNaN(lat)) return null;

  return {
    fdId: p.fd_id ? String(p.fd_id) : null,
    lng,
    lat,
    sqft: p.sqft ? Math.round(Number(p.sqft)) : null,
    yearBuilt: p.med_yr_blt ? Math.round(Number(p.med_yr_blt)) : null,
    replacementValue: p.val_struct ? Number(p.val_struct) : null,
    occupancyType: p.occtype || null,
    damageCategory: p.st_damcat || null,
    bldgType: p.bldgtype || null,
    numStories: p.num_story != null ? Number(p.num_story) : null,
    foundationType: p.found_type || null,
    foundationHeight: p.found_ht != null ? Number(p.found_ht) : null,
    groundElevation: p.ground_elv != null ? Number(p.ground_elv) : null,
  };
}

/**
 * Bulk upsert FEMA records by spatial matching.
 * Uses a single SQL query with unnest arrays + LATERAL join to match
 * FEMA structures to nearest existing property within 30m.
 */
async function upsertFemaBatch(batch) {
  if (batch.length === 0) return { matched: 0, created: 0 };

  // Filter out records without fdId
  const valid = batch.filter(r => r.fdId);
  if (valid.length === 0) return { matched: 0, created: 0 };

  // Bulk UPDATE: match FEMA points to nearest existing property within 30m
  const updateResult = await pool.query(`
    WITH fema_data AS (
      SELECT
        unnest($1::text[]) AS fd_id,
        unnest($2::float8[]) AS lng,
        unnest($3::float8[]) AS lat,
        unnest($4::int[]) AS sqft,
        unnest($5::int[]) AS yr_built,
        unnest($6::numeric[]) AS repl_val,
        unnest($7::text[]) AS occ_type,
        unnest($8::text[]) AS dmg_cat,
        unnest($9::text[]) AS bldg_type,
        unnest($10::numeric[]) AS num_stories,
        unnest($11::text[]) AS found_type,
        unnest($12::numeric[]) AS found_ht,
        unnest($13::numeric[]) AS ground_elv
    ),
    matches AS (
      SELECT DISTINCT ON (p.id)
        p.id AS property_id, f.*
      FROM fema_data f
      CROSS JOIN LATERAL (
        SELECT id FROM properties
        WHERE fema_fd_id IS NULL
          AND location && ST_Expand(ST_SetSRID(ST_MakePoint(f.lng, f.lat), 4326), 0.0003)
          AND ST_DWithin(
            location::geography,
            ST_SetSRID(ST_MakePoint(f.lng, f.lat), 4326)::geography,
            30
          )
        ORDER BY location <-> ST_SetSRID(ST_MakePoint(f.lng, f.lat), 4326)
        LIMIT 1
      ) p
      WHERE NOT EXISTS (SELECT 1 FROM properties WHERE fema_fd_id = f.fd_id)
    )
    UPDATE properties SET
      fema_fd_id = m.fd_id,
      fema_sqft = COALESCE(m.sqft, properties.fema_sqft),
      fema_year_built = COALESCE(m.yr_built, properties.fema_year_built),
      fema_replacement_value = COALESCE(m.repl_val, properties.fema_replacement_value),
      fema_occupancy_type = COALESCE(m.occ_type, properties.fema_occupancy_type),
      fema_damage_category = COALESCE(m.dmg_cat, properties.fema_damage_category),
      fema_bldg_type = COALESCE(m.bldg_type, properties.fema_bldg_type),
      fema_num_stories = COALESCE(m.num_stories, properties.fema_num_stories),
      fema_foundation_type = COALESCE(m.found_type, properties.fema_foundation_type),
      fema_foundation_height = COALESCE(m.found_ht, properties.fema_foundation_height),
      fema_ground_elevation = COALESCE(m.ground_elv, properties.fema_ground_elevation),
      fema_fetched_at = NOW(),
      updated_at = NOW()
    FROM matches m
    WHERE properties.id = m.property_id
  `, [
    valid.map(r => r.fdId),
    valid.map(r => r.lng),
    valid.map(r => r.lat),
    valid.map(r => r.sqft),
    valid.map(r => r.yearBuilt),
    valid.map(r => r.replacementValue),
    valid.map(r => r.occupancyType),
    valid.map(r => r.damageCategory),
    valid.map(r => r.bldgType),
    valid.map(r => r.numStories),
    valid.map(r => r.foundationType),
    valid.map(r => r.foundationHeight),
    valid.map(r => r.groundElevation),
  ]);

  const matched = updateResult.rowCount;

  return { matched, created: 0 };
}

/**
 * Import FEMA NSI structures for a bounding box.
 * Filters to Texas residential only.
 *
 * @param {{ xmin, ymin, xmax, ymax }} bbox
 * @returns {{ total: number, matched: number, created: number }}
 */
export async function importByBbox(bbox) {
  logger.info({ bbox }, 'FEMA NSI import starting (bbox)');

  const features = await fetchByBbox(bbox);
  const filtered = filterTexasResidential(features);

  logger.info(`FEMA NSI: ${features.length} total structures, ${filtered.length} TX residential`);

  const records = filtered.map(extractFemaData).filter(Boolean);
  let totalMatched = 0;
  let totalCreated = 0;

  // Process in batches
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { matched, created } = await upsertFemaBatch(batch);
    totalMatched += matched;
    totalCreated += created;

    const pct = Math.round(((i + batch.length) / records.length) * 100);
    logger.info(`FEMA NSI: ${i + batch.length}/${records.length} (${pct}%) — ${totalMatched} matched, ${totalCreated} created`);

    if (i + BATCH_SIZE < records.length) {
      await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
    }
  }

  logger.info(`FEMA NSI import complete: ${totalMatched} matched, ${totalCreated} created`);
  return { total: records.length, matched: totalMatched, created: totalCreated };
}

/**
 * Import FEMA NSI structures for a storm swath polygon.
 * Posts the swath GeoJSON geometry to the NSI API.
 *
 * @param {object} geojson - GeoJSON Polygon or MultiPolygon geometry
 * @returns {{ total: number, matched: number, created: number }}
 */
export async function importBySwathGeometry(geojson) {
  logger.info('FEMA NSI import starting (swath polygon)');

  const features = await fetchByPolygon(geojson);
  const filtered = filterTexasResidential(features);

  logger.info(`FEMA NSI: ${features.length} total structures, ${filtered.length} TX residential`);

  const records = filtered.map(extractFemaData).filter(Boolean);
  let totalMatched = 0;
  let totalCreated = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { matched, created } = await upsertFemaBatch(batch);
    totalMatched += matched;
    totalCreated += created;

    if (i + BATCH_SIZE < records.length) {
      await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
    }
  }

  logger.info(`FEMA NSI swath import complete: ${totalMatched} matched, ${totalCreated} created`);
  return { total: records.length, matched: totalMatched, created: totalCreated };
}

/**
 * Import FEMA NSI structures for a specific storm event by its ID.
 * Fetches the swath geometry from the database and queries NSI.
 *
 * @param {string} stormEventId - UUID of the storm_events row
 * @returns {{ total: number, matched: number, created: number }}
 */
export async function importByStormEvent(stormEventId) {
  const { rows } = await pool.query(
    'SELECT ST_AsGeoJSON(geom)::json as geojson FROM storm_events WHERE id = $1',
    [stormEventId]
  );

  if (rows.length === 0) {
    throw new Error(`Storm event ${stormEventId} not found`);
  }

  const geojson = rows[0].geojson;
  if (!geojson) {
    throw new Error(`Storm event ${stormEventId} has no geometry`);
  }

  return importBySwathGeometry(geojson);
}
