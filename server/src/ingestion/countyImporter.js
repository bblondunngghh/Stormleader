import pool from '../db/pool.js';
import logger from '../utils/logger.js';

const PAGE_SIZE = 2000;
const RATE_LIMIT_MS = 200;

/**
 * Compute centroid from an ArcGIS polygon ring.
 */
function centroidFromRing(ring) {
  let sumX = 0, sumY = 0;
  for (const [x, y] of ring) {
    sumX += x;
    sumY += y;
  }
  return { lng: sumX / ring.length, lat: sumY / ring.length };
}

/**
 * Build the outFields list from a field_map, requesting only mapped fields.
 */
function buildOutFields(fieldMap) {
  const fields = new Set();
  for (const arcField of Object.values(fieldMap)) {
    if (arcField) fields.add(arcField);
  }
  return [...fields].join(',');
}

/**
 * Build address line from feature attributes using the field map.
 * Prefers component fields (num + prefix + street + suffix), falls back to full address field.
 */
function buildAddress(attrs, fieldMap) {
  const parts = [
    fieldMap.address_num && attrs[fieldMap.address_num],
    fieldMap.street_prefix && attrs[fieldMap.street_prefix],
    fieldMap.street && attrs[fieldMap.street],
    fieldMap.street_suffix && attrs[fieldMap.street_suffix],
  ].filter(Boolean);

  if (parts.length > 0) return parts.join(' ').trim();
  if (fieldMap.address && attrs[fieldMap.address]) return String(attrs[fieldMap.address]).trim();
  return '';
}

/**
 * Extract a property record from an ArcGIS feature using the field map.
 */
function extractProperty(feature, fieldMap, countyName, dataSourceTag) {
  const attrs = feature.attributes;

  // Get coordinates from geometry
  let lng, lat;
  if (feature.geometry?.rings?.length > 0) {
    const c = centroidFromRing(feature.geometry.rings[0]);
    lng = c.lng;
    lat = c.lat;
  } else if (feature.geometry?.x != null && feature.geometry?.y != null) {
    lng = feature.geometry.x;
    lat = feature.geometry.y;
  } else {
    return null;
  }

  if (isNaN(lng) || isNaN(lat)) return null;

  const parcelIdField = fieldMap.parcel_id;
  if (!parcelIdField || !attrs[parcelIdField]) return null;

  // Use county from the feature data if a county_field is mapped, otherwise use the source county name
  const county = (fieldMap.county_field && attrs[fieldMap.county_field])
    ? String(attrs[fieldMap.county_field]).trim()
    : countyName;

  return {
    countyParcelId: String(attrs[parcelIdField]),
    addressLine1: buildAddress(attrs, fieldMap),
    city: (fieldMap.city && attrs[fieldMap.city]) ? String(attrs[fieldMap.city]) : '',
    zip: (fieldMap.zip && attrs[fieldMap.zip]) ? String(attrs[fieldMap.zip]) : '',
    ownerName: (fieldMap.owner_name && attrs[fieldMap.owner_name]) ? String(attrs[fieldMap.owner_name]) : null,
    yearBuilt: (fieldMap.year_built && attrs[fieldMap.year_built]) ? Number(attrs[fieldMap.year_built]) || null : null,
    assessedValue: (fieldMap.assessed_value && attrs[fieldMap.assessed_value]) ? Number(attrs[fieldMap.assessed_value]) || null : null,
    county,
    dataSource: dataSourceTag,
    lng,
    lat,
  };
}

/**
 * Bulk upsert a batch of property records.
 */
async function upsertBatch(batch) {
  if (batch.length === 0) return 0;

  // Deduplicate by parcel ID within batch
  const seen = new Set();
  const unique = batch.filter(b => {
    if (seen.has(b.countyParcelId)) return false;
    seen.add(b.countyParcelId);
    return true;
  });

  const result = await pool.query(`
    INSERT INTO properties (
      county_parcel_id, address_line1, city, state, zip,
      location, data_source, county,
      owner_last_name, year_built, assessed_value
    )
    SELECT
      unnest($1::varchar[]),
      unnest($2::varchar[]),
      unnest($3::varchar[]),
      'TX',
      unnest($4::varchar[]),
      ST_SetSRID(ST_MakePoint(unnest($5::float8[]), unnest($6::float8[])), 4326),
      unnest($7::varchar[]),
      unnest($8::varchar[]),
      unnest($9::varchar[]),
      unnest($10::int[]),
      unnest($11::numeric[])
    ON CONFLICT (county_parcel_id) DO UPDATE SET
      address_line1 = EXCLUDED.address_line1,
      city = EXCLUDED.city,
      zip = EXCLUDED.zip,
      location = EXCLUDED.location,
      county = EXCLUDED.county,
      owner_last_name = COALESCE(EXCLUDED.owner_last_name, properties.owner_last_name),
      year_built = COALESCE(EXCLUDED.year_built, properties.year_built),
      assessed_value = COALESCE(EXCLUDED.assessed_value, properties.assessed_value),
      updated_at = NOW()
  `, [
    unique.map(b => b.countyParcelId),
    unique.map(b => b.addressLine1),
    unique.map(b => b.city),
    unique.map(b => b.zip),
    unique.map(b => b.lng),
    unique.map(b => b.lat),
    unique.map(b => b.dataSource),
    unique.map(b => b.county),
    unique.map(b => b.ownerName),
    unique.map(b => b.yearBuilt),
    unique.map(b => b.assessedValue),
  ]);

  return result.rowCount;
}

/**
 * Build ArcGIS query URL with optional bbox geometry filter.
 */
function buildQueryUrl(baseUrl, outFields, where, offset, bbox) {
  const params = {
    where,
    outFields,
    returnGeometry: 'true',
    outSR: '4326',
    resultOffset: String(offset),
    resultRecordCount: String(PAGE_SIZE),
    f: 'json',
  };

  if (bbox) {
    // bbox = { xmin, ymin, xmax, ymax }
    params.geometry = JSON.stringify({
      xmin: bbox.xmin, ymin: bbox.ymin,
      xmax: bbox.xmax, ymax: bbox.ymax,
      spatialReference: { wkid: 4326 },
    });
    params.geometryType = 'esriGeometryEnvelope';
    params.spatialRel = 'esriSpatialRelIntersects';
    params.inSR = '4326';
  }

  return `${baseUrl}?` + new URLSearchParams(params);
}

/**
 * Get the total record count from ArcGIS for a query.
 */
async function getRecordCount(baseUrl, where, bbox) {
  const params = {
    where,
    returnCountOnly: 'true',
    f: 'json',
  };

  if (bbox) {
    params.geometry = JSON.stringify({
      xmin: bbox.xmin, ymin: bbox.ymin,
      xmax: bbox.xmax, ymax: bbox.ymax,
      spatialReference: { wkid: 4326 },
    });
    params.geometryType = 'esriGeometryEnvelope';
    params.spatialRel = 'esriSpatialRelIntersects';
    params.inSR = '4326';
  }

  const url = `${baseUrl}?` + new URLSearchParams(params);
  const res = await fetch(url);
  const data = await res.json();
  return data.count || 0;
}

/**
 * Import all parcels for a county using its county_data_sources config.
 *
 * @param {string} countySourceId - UUID of the county_data_sources row
 * @param {object} [options]
 * @param {object} [options.bbox] - { xmin, ymin, xmax, ymax } spatial filter
 * @param {string} [options.where] - ArcGIS WHERE clause
 * @param {number} [options.maxRecords] - Stop after this many records
 * @returns {{ total: number, countyName: string }}
 */
export async function importCounty(countySourceId, options = {}) {
  // Load county config
  const { rows } = await pool.query(
    'SELECT * FROM county_data_sources WHERE id = $1 AND enabled = true',
    [countySourceId]
  );
  if (rows.length === 0) {
    throw new Error(`County source ${countySourceId} not found or disabled`);
  }

  const source = rows[0];
  const fieldMap = source.field_map;
  const outFields = buildOutFields(fieldMap);
  const where = options.where || '1=1';
  const maxRecords = options.maxRecords || Infinity;
  const bbox = options.bbox || null;

  logger.info({ county: source.county_name, bbox }, `County import starting: ${source.county_name}`);

  const count = await getRecordCount(source.arcgis_url, where, bbox);
  logger.info(`${source.county_name} import: ${count} parcels match query`);

  if (count === 0) {
    return { total: 0, countyName: source.county_name };
  }

  let offset = 0;
  let totalUpserted = 0;

  while (offset < count && totalUpserted < maxRecords) {
    const url = buildQueryUrl(source.arcgis_url, outFields, where, offset, bbox);

    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      logger.error({ error: data.error, county: source.county_name }, 'ArcGIS query error');
      break;
    }

    if (!data.features || data.features.length === 0) break;

    // Extract properties from features
    const batch = [];
    for (const feature of data.features) {
      const prop = extractProperty(feature, fieldMap, source.county_name, source.data_source_tag);
      if (prop) batch.push(prop);
    }

    totalUpserted += await upsertBatch(batch);

    offset += data.features.length;
    const pct = count > 0 ? Math.round((offset / count) * 100) : 0;
    logger.info(`${source.county_name} import: ${offset}/${count} (${pct}%) — ${totalUpserted} upserted`);

    // Rate limit
    await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
  }

  // Update county source metadata
  await pool.query(`
    UPDATE county_data_sources
    SET last_imported_at = NOW(), total_records = $1
    WHERE id = $2
  `, [totalUpserted, countySourceId]);

  logger.info(`${source.county_name} import complete: ${totalUpserted} records upserted`);
  return { total: totalUpserted, countyName: source.county_name };
}

/**
 * Import parcels within a bounding box, auto-detecting which county sources overlap.
 *
 * @param {{ xmin: number, ymin: number, xmax: number, ymax: number }} bbox
 * @param {object} [options]
 * @param {number} [options.bufferKm] - Buffer around bbox in km (default 5)
 * @returns {Array<{ total: number, countyName: string }>}
 */
export async function importCountiesByBbox(bbox, options = {}) {
  const bufferKm = options.bufferKm ?? 5;
  // ~0.009 degrees per km at TX latitudes
  const bufferDeg = bufferKm * 0.009;

  const bufferedBbox = {
    xmin: bbox.xmin - bufferDeg,
    ymin: bbox.ymin - bufferDeg,
    xmax: bbox.xmax + bufferDeg,
    ymax: bbox.ymax + bufferDeg,
  };

  // Find county sources whose bbox overlaps the search area
  const { rows: sources } = await pool.query(`
    SELECT id, county_name, last_imported_at
    FROM county_data_sources
    WHERE enabled = true
      AND bbox && ST_MakeEnvelope($1, $2, $3, $4, 4326)
  `, [bufferedBbox.xmin, bufferedBbox.ymin, bufferedBbox.xmax, bufferedBbox.ymax]);

  if (sources.length === 0) {
    logger.info({ bbox }, 'No county sources overlap this bbox');
    return [];
  }

  const results = [];
  for (const source of sources) {
    // For per-county sources, skip if imported within 30 days
    // For statewide sources, check if we already have properties in this specific bbox
    if (source.county_name.startsWith('_')) {
      // Statewide source — check if properties already exist in this bbox
      const { rows: [{ cnt }] } = await pool.query(`
        SELECT COUNT(*) as cnt FROM properties
        WHERE ST_Intersects(location, ST_MakeEnvelope($1, $2, $3, $4, 4326))
        LIMIT 1
      `, [bufferedBbox.xmin, bufferedBbox.ymin, bufferedBbox.xmax, bufferedBbox.ymax]);
      if (parseInt(cnt) > 0) {
        logger.info(`${source.county_name}: properties already exist in bbox, skipping`);
        continue;
      }
    } else if (source.last_imported_at) {
      const daysSince = (Date.now() - new Date(source.last_imported_at).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 30) {
        logger.info(`${source.county_name} imported ${Math.round(daysSince)} days ago, skipping`);
        continue;
      }
    }

    try {
      const result = await importCounty(source.id, { bbox: bufferedBbox, maxRecords: 50000 });
      results.push(result);
    } catch (err) {
      logger.error({ err, county: source.county_name }, 'Failed to import county by bbox');
    }
  }

  return results;
}

/**
 * Find which county data source covers a given point.
 *
 * @param {number} lng
 * @param {number} lat
 * @returns {object|null} county_data_sources row or null
 */
export async function discoverCountyForPoint(lng, lat) {
  const { rows } = await pool.query(`
    SELECT * FROM county_data_sources
    WHERE enabled = true
      AND ST_Contains(bbox, ST_SetSRID(ST_MakePoint($1, $2), 4326))
    LIMIT 1
  `, [lng, lat]);

  return rows[0] || null;
}
