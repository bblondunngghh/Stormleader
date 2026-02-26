import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { importCounty } from './countyImporter.js';

/**
 * Import Travis County parcels using the generic county importer.
 * This is a backwards-compatible wrapper — callers that used importTCADParcels()
 * continue to work without changes.
 *
 * @param {object} [options]
 * @param {string} [options.where] - SQL WHERE filter (e.g., "situs_city='AUSTIN'")
 * @param {number} [options.maxRecords] - Stop after this many records (for testing)
 * @returns {number} Total records imported
 */
export async function importTCADParcels(options = {}) {
  // Look up Travis County source by name
  const { rows } = await pool.query(
    "SELECT id FROM county_data_sources WHERE LOWER(county_name) = 'travis' AND state = 'TX' LIMIT 1"
  );

  if (rows.length === 0) {
    logger.warn('Travis County not found in county_data_sources — falling back is not available. Run migration 014.');
    return 0;
  }

  const result = await importCounty(rows[0].id, {
    where: options.where,
    maxRecords: options.maxRecords,
  });

  return result.total;
}
