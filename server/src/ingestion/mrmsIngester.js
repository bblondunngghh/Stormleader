import pako from 'pako';
import { parseGrib } from './gribParser.js';
import { buildContours } from './contourBuilder.js';
import pool from '../db/pool.js';
import logger from '../utils/logger.js';

const BUCKET_URL = 'https://noaa-mrms-pds.s3.amazonaws.com';
const PREFIX = 'CONUS/MESH_Max_1440min_00.50';

/**
 * Ingest the latest MRMS MESH Max 1440min file for today (or a specific date).
 * Downloads GRIB2 from NOAA's public S3 bucket via HTTPS, parses the grid,
 * contours it at hail-size thresholds, and inserts polygon swaths into PostGIS.
 *
 * @param {string} [dateStr] - Optional YYYYMMDD string. Defaults to today.
 */
export async function ingestMRMS(dateStr) {
  if (!dateStr) {
    const now = new Date();
    dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  }

  logger.info(`Starting MRMS ingestion for ${dateStr}`);

  // List files for the given date
  const listUrl = `${BUCKET_URL}/?prefix=${PREFIX}/${dateStr}/&max-keys=200`;
  const listRes = await fetch(listUrl);
  const listXml = await listRes.text();

  // Extract keys from XML
  const keys = [...listXml.matchAll(/<Key>([^<]+)<\/Key>/g)].map(m => m[1]);
  const gzFiles = keys.filter(k => k.endsWith('.grib2.gz'));

  if (gzFiles.length === 0) {
    logger.warn(`No MRMS MESH files found for ${dateStr}`);
    return 0;
  }

  // Pick the latest file (last in sorted order = end of day = fullest swath)
  const latestKey = gzFiles[gzFiles.length - 1];
  logger.info(`Downloading: ${latestKey}`);

  const fileUrl = `${BUCKET_URL}/${latestKey}`;
  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) {
    throw new Error(`Failed to download MRMS file: ${fileRes.status}`);
  }

  const compressed = Buffer.from(await fileRes.arrayBuffer());
  const decompressed = pako.inflate(compressed);
  logger.info(`Decompressed MRMS data: ${decompressed.length} bytes`);

  // Parse GRIB2 to grid
  const grid = parseGrib(decompressed);

  // Build contour polygons at hail-size thresholds (inches)
  // These match the spec color coding: green(0.75), yellow(1.0), orange(1.5), red(2.0)
  const thresholds = [0.75, 1.0, 1.5, 2.0, 2.5, 3.0];
  const features = buildContours(grid, thresholds);

  if (features.length === 0) {
    logger.info('No contours above thresholds for this file');
    return 0;
  }

  // Extract timestamp from filename: MRMS_MESH_Max_1440min_00.50_YYYYMMDD-HHMMSS.grib2.gz
  const tsMatch = latestKey.match(/(\d{8})-(\d{6})/);
  let eventStart = new Date();
  if (tsMatch) {
    const d = tsMatch[1];
    const t = tsMatch[2];
    eventStart = new Date(`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}T${t.slice(0,2)}:${t.slice(2,4)}:${t.slice(4,6)}Z`);
  }

  const baseName = latestKey.split('/').pop().replace('.grib2.gz', '');
  let inserted = 0;

  for (const feature of features) {
    const hailSize = feature.properties.hail_size_max_in;
    const sourceId = `${baseName}_${hailSize}in`;
    const geojson = JSON.stringify(feature.geometry);

    try {
      const { rowCount } = await pool.query(
        `INSERT INTO storm_events (source, source_id, geom, hail_size_max_in, event_start, raw_data)
         VALUES ('mrms_mesh', $1, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), $3, $4, $5)
         ON CONFLICT (source, source_id) DO NOTHING`,
        [sourceId, geojson, hailSize, eventStart, JSON.stringify({ file: latestKey, threshold: hailSize })]
      );
      inserted += rowCount;
    } catch (err) {
      logger.warn({ err: err.message }, `Failed to insert contour at ${hailSize}in`);
    }
  }

  logger.info(`MRMS ingestion complete: ${inserted} swath polygons inserted for ${dateStr}`);
  return inserted;
}

/**
 * Backfill MRMS MESH swaths for the past N days.
 */
export async function backfillMRMS(days = 7) {
  logger.info(`Backfilling MRMS MESH for past ${days} days`);
  let total = 0;
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    try {
      const count = await ingestMRMS(dateStr);
      total += count;
    } catch (err) {
      logger.error({ err: err.message }, `Failed MRMS ingestion for ${dateStr}`);
    }
  }

  logger.info(`MRMS backfill complete: ${total} total swath polygons`);
  return total;
}
