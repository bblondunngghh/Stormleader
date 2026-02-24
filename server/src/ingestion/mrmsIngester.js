import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import pako from 'pako';
import { parseGrib } from './gribParser.js';
import { buildContours } from './contourBuilder.js';
import pool from '../db/pool.js';
import logger from '../utils/logger.js';

const s3 = new S3Client({ region: 'us-east-1', signer: { sign: async (req) => req } });
const BUCKET = 'noaa-mrms-pds';
const PREFIX = 'CONUS/MESHMax1440min/';

export async function ingestMRMS() {
  logger.info('Starting MRMS ingestion');

  // List recent files in the MRMS bucket
  const listCmd = new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: PREFIX,
    MaxKeys: 20,
  });

  const listing = await s3.send(listCmd);
  if (!listing.Contents || listing.Contents.length === 0) {
    logger.warn('No MRMS files found');
    return;
  }

  // Sort by LastModified descending, pick the latest .gz file
  const gzFiles = listing.Contents
    .filter((obj) => obj.Key.endsWith('.gz'))
    .sort((a, b) => (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0));

  if (gzFiles.length === 0) {
    logger.warn('No .gz files found in MRMS prefix');
    return;
  }

  const latest = gzFiles[0];
  logger.info(`Downloading MRMS file: ${latest.Key}`);

  const getCmd = new GetObjectCommand({ Bucket: BUCKET, Key: latest.Key });
  const response = await s3.send(getCmd);

  // Read the stream into a buffer
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  const compressed = Buffer.concat(chunks);

  // Decompress gzip
  const decompressed = pako.inflate(compressed);
  logger.info(`Decompressed MRMS data: ${decompressed.length} bytes`);

  // Parse GRIB2 to grid
  const grid = parseGrib(decompressed);

  // Build contour polygons at hail-size thresholds (inches)
  const thresholds = [1.0, 1.5, 2.0, 2.5, 3.0];
  const features = buildContours(grid, thresholds);

  if (features.length === 0) {
    logger.info('No contours above thresholds, skipping insert');
    return;
  }

  // Derive a source_id from the filename + threshold
  const baseName = latest.Key.split('/').pop().replace('.gz', '');

  let inserted = 0;
  for (const feature of features) {
    const sourceId = `${baseName}_${feature.properties.hail_size_max_in}in`;
    const geojson = JSON.stringify(feature.geometry);

    const { rowCount } = await pool.query(
      `INSERT INTO storm_events (source, source_id, geom, hail_size_max_in, event_start, raw_data)
       VALUES ('mrms_mesh', $1, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), $3, NOW(), $4)
       ON CONFLICT (source, source_id) DO NOTHING`,
      [sourceId, geojson, feature.properties.hail_size_max_in, JSON.stringify({ file: latest.Key })]
    );
    inserted += rowCount;
  }

  logger.info(`MRMS ingestion complete: ${inserted} new storm events inserted`);
}
