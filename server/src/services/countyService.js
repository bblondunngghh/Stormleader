import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { importCounty, importCountiesByBbox, getImportProgress, resetImportProgress, importProgress } from '../ingestion/countyImporter.js';
import { importByBbox as importFemaByBbox } from '../ingestion/femaIngester.js';

export { getImportProgress };

/**
 * List all county data sources with their import status.
 */
export async function listCounties() {
  const { rows } = await pool.query(`
    SELECT id, county_name, state, fips_code, arcgis_url,
           data_source_tag, geometry_type, enabled,
           last_imported_at, total_records, created_at
    FROM county_data_sources
    ORDER BY county_name
  `);
  return rows;
}

/**
 * Get a single county data source by ID or county name.
 */
export async function getCounty(idOrName) {
  const { rows } = await pool.query(`
    SELECT * FROM county_data_sources
    WHERE id::text = $1 OR LOWER(county_name) = LOWER($1)
    LIMIT 1
  `, [idOrName]);
  return rows[0] || null;
}

/**
 * Add a new county data source.
 */
export async function addCounty({ county_name, state, fips_code, arcgis_url, field_map, geometry_type, data_source_tag, bbox }) {
  const bboxSql = bbox
    ? `ST_MakeEnvelope(${bbox.xmin}, ${bbox.ymin}, ${bbox.xmax}, ${bbox.ymax}, 4326)`
    : 'NULL';

  const { rows } = await pool.query(`
    INSERT INTO county_data_sources (
      county_name, state, fips_code, arcgis_url, field_map,
      geometry_type, data_source_tag, bbox
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, ${bboxSql})
    RETURNING *
  `, [
    county_name,
    state || 'TX',
    fips_code || null,
    arcgis_url,
    JSON.stringify(field_map),
    geometry_type || 'polygon',
    data_source_tag,
  ]);

  return rows[0];
}

// Track running imports for status reporting
const activeImports = new Map();

/**
 * Trigger an import for a county. Runs in the background and returns immediately.
 */
export function triggerImport(countyId, options = {}) {
  if (activeImports.has(countyId)) {
    return { status: 'already_running', countyId };
  }

  const importState = {
    countyId,
    startedAt: new Date().toISOString(),
    status: 'running',
    total: null,
    error: null,
  };
  activeImports.set(countyId, importState);

  // Run import in background
  importCounty(countyId, options)
    .then(result => {
      importState.status = 'completed';
      importState.total = result.total;
      importState.completedAt = new Date().toISOString();
      logger.info({ countyId, total: result.total }, 'County import completed');
    })
    .catch(err => {
      importState.status = 'failed';
      importState.error = err.message;
      logger.error({ err, countyId }, 'County import failed');
    })
    .finally(() => {
      // Remove from active after 10 minutes so status can be queried briefly
      setTimeout(() => activeImports.delete(countyId), 10 * 60 * 1000);
    });

  return { status: 'started', countyId };
}

/**
 * Get import status for a county.
 */
export function getImportStatus(countyId) {
  return activeImports.get(countyId) || null;
}

/**
 * Storm-triggered auto-import: check storm bbox against county sources
 * and import any counties that need data.
 */
// Global cap to stay within Neon free tier storage limits
const MAX_TOTAL_PROPERTIES = 100000;

export async function autoImportForStorms() {
  // Get tight bounding boxes from individual storm swaths (not huge grid clusters)
  // Uses 0.1-degree grid (~11km) to group only truly overlapping storms
  const { rows: stormBboxes } = await pool.query(`
    SELECT
      ST_XMin(ST_Extent(geom)) as xmin, ST_YMin(ST_Extent(geom)) as ymin,
      ST_XMax(ST_Extent(geom)) as xmax, ST_YMax(ST_Extent(geom)) as ymax,
      COUNT(*) as storm_count
    FROM storm_events
    WHERE event_start > NOW() - INTERVAL '7 days'
      AND geom IS NOT NULL
      AND ST_Intersects(geom, ST_MakeEnvelope(-106.65, 25.84, -93.51, 36.50, 4326))
    GROUP BY ST_SnapToGrid(ST_Centroid(geom), 0.1)
  `);

  if (stormBboxes.length === 0) {
    logger.info('Auto-import: no recent TX storms found');
    return;
  }

  // Check how many properties already exist — respect global cap
  const { rows: [{ cnt }] } = await pool.query('SELECT COUNT(*) as cnt FROM properties');
  const existingCount = parseInt(cnt);
  const remaining = MAX_TOTAL_PROPERTIES - existingCount;

  if (remaining <= 0) {
    logger.info(`Auto-import: already at ${existingCount} properties (cap: ${MAX_TOTAL_PROPERTIES}), skipping`);
    return;
  }

  logger.info(`Auto-import: found ${stormBboxes.length} storm clusters in TX (${existingCount} properties exist, ${remaining} capacity remaining)`);
  resetImportProgress(stormBboxes.length);

  let totalImported = 0;

  for (const bbox of stormBboxes) {
    if (totalImported >= remaining) {
      logger.info(`Auto-import: reached global cap (${MAX_TOTAL_PROPERTIES}), stopping`);
      break;
    }

    const parsedBbox = {
      xmin: parseFloat(bbox.xmin),
      ymin: parseFloat(bbox.ymin),
      xmax: parseFloat(bbox.xmax),
      ymax: parseFloat(bbox.ymax),
    };

    // Cap per-cluster to avoid one huge cluster eating all capacity
    const clusterCap = Math.min(10000, remaining - totalImported);

    // County parcel data
    try {
      const results = await importCountiesByBbox(parsedBbox, { bufferKm: 1, maxRecords: clusterCap });
      for (const r of results) totalImported += r.total;
    } catch (err) {
      logger.error({ err }, 'Auto-import county data for storm cluster failed');
    }

    // FEMA NSI structure data
    try {
      await importFemaByBbox(parsedBbox);
    } catch (err) {
      logger.error({ err }, 'Auto-import FEMA NSI data for storm cluster failed');
    }
  }

  importProgress.active = false;
  importProgress.current = null;
  logger.info(`Auto-import complete: ${totalImported} new properties imported`);
}
