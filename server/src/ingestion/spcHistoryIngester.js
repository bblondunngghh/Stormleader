import crypto from 'crypto';
import pool from '../db/pool.js';
import logger from '../utils/logger.js';

const SPC_BASE = 'https://www.spc.noaa.gov/climo/reports';

/**
 * Fetch and ingest SPC daily storm reports for a given date.
 * Pulls hail, wind, and tornado reports from the SPC archive.
 *
 * @param {Date} date - The date to ingest
 */
export async function ingestSPCDate(date) {
  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const dateStr = `${yy}${mm}${dd}`;

  const types = [
    { file: `${dateStr}_rpts_hail.csv`, parseRow: parseHailRow },
    { file: `${dateStr}_rpts_wind.csv`, parseRow: parseWindRow },
    { file: `${dateStr}_rpts_torn.csv`, parseRow: parseTornadoRow },
  ];

  let totalInserted = 0;
  const allInsertedIds = [];

  for (const { file, parseRow } of types) {
    const url = `${SPC_BASE}/${file}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        logger.warn(`SPC archive returned ${response.status} for ${file}`);
        continue;
      }

      const text = await response.text();
      const lines = text.trim().split('\n');
      const startIdx = lines[0]?.toLowerCase().includes('time') ? 1 : 0;

      // Parse all reports first
      const reports = [];
      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const event = parseRow(line, date);
        if (!event) continue;

        const bufferMeters = event.rawData.type === 'hail'
          ? Math.max(800, (event.hailSize || 1) * 800)
          : event.rawData.type === 'tornado' ? 600 : 500;

        reports.push({ ...event, bufferMeters });
      }

      if (reports.length === 0) continue;

      // Batch-check which source_ids already exist
      const sourceIds = reports.map(r => r.sourceId);
      const { rows } = await pool.query(
        `SELECT source_id FROM storm_events WHERE source = 'spc_report' AND source_id = ANY($1)`,
        [sourceIds]
      );
      const existingIds = new Set(rows.map(r => r.source_id));
      const newReports = reports.filter(r => !existingIds.has(r.sourceId));

      if (newReports.length === 0) continue;

      let inserted = 0;
      const insertedIds = [];
      for (const event of newReports) {
        const { rows: insertedRows, rowCount } = await pool.query(
          `INSERT INTO storm_events (source, source_id, geom, hail_size_max_in, wind_speed_max_mph, event_start, raw_data)
           VALUES ($1, $2,
             ST_Simplify(ST_Buffer(ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)::geography, $8)::geometry, 0.0001),
             $4, $5, $6, $7)
           ON CONFLICT (source, source_id) DO NOTHING
           RETURNING id`,
          [event.source, event.sourceId, event.geojson, event.hailSize, event.windSpeed, event.eventStart, JSON.stringify(event.rawData), event.bufferMeters]
        );
        inserted += rowCount;
        if (insertedRows.length > 0) insertedIds.push(insertedRows[0].id);
      }
      if (inserted > 0) {
        logger.info(`Ingested ${inserted} new reports from ${file} (${existingIds.size} already existed)`);
      }
      totalInserted += inserted;
      allInsertedIds.push(...insertedIds);
    } catch (err) {
      logger.error({ err }, `Failed to ingest ${file}`);
    }
  }

  return { inserted: totalInserted, insertedIds: allInsertedIds };
}

function parseHailRow(line, date) {
  const parts = line.split(',');
  if (parts.length < 7) return null;

  const [time, size, location, county, state, lat, lon, ...remarkParts] = parts;
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);
  if (isNaN(latitude) || isNaN(longitude)) return null;

  const lng = longitude > 0 ? -longitude : longitude;
  if (!isInTexas(latitude, lng)) return null;
  const hailParsed = parseFloat(size) / 100;
  const hailSize = Number.isFinite(hailParsed) ? hailParsed : null;

  return {
    source: 'spc_report',
    sourceId: makeSourceId('hail', time, latitude, lng),
    geojson: JSON.stringify({ type: 'Point', coordinates: [lng, latitude] }),
    hailSize: isNaN(hailSize) ? null : hailSize,
    windSpeed: null,
    eventStart: makeTimestamp(date, time),
    rawData: { type: 'hail', location, county, state, remarks: remarkParts.join(',').trim(), size },
  };
}

function parseWindRow(line, date) {
  const parts = line.split(',');
  if (parts.length < 7) return null;

  const [time, speed, location, county, state, lat, lon, ...remarkParts] = parts;
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);
  if (isNaN(latitude) || isNaN(longitude)) return null;

  const lng = longitude > 0 ? -longitude : longitude;
  if (!isInTexas(latitude, lng)) return null;
  const windParsed = speed === 'UNK' ? NaN : parseFloat(speed);
  const windMph = Number.isFinite(windParsed) ? windParsed : null;

  return {
    source: 'spc_report',
    sourceId: makeSourceId('wind', time, latitude, lng),
    geojson: JSON.stringify({ type: 'Point', coordinates: [lng, latitude] }),
    hailSize: null,
    windSpeed: isNaN(windMph) ? null : windMph,
    eventStart: makeTimestamp(date, time),
    rawData: { type: 'wind', location, county, state, remarks: remarkParts.join(',').trim(), speed },
  };
}

function parseTornadoRow(line, date) {
  const parts = line.split(',');
  if (parts.length < 7) return null;

  const [time, fscale, location, county, state, lat, lon, ...remarkParts] = parts;
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);
  if (isNaN(latitude) || isNaN(longitude)) return null;

  const lng = longitude > 0 ? -longitude : longitude;
  if (!isInTexas(latitude, lng)) return null;

  return {
    source: 'spc_report',
    sourceId: makeSourceId('torn', time, latitude, lng),
    geojson: JSON.stringify({ type: 'Point', coordinates: [lng, latitude] }),
    hailSize: null,
    windSpeed: null,
    eventStart: makeTimestamp(date, time),
    rawData: { type: 'tornado', fscale, location, county, state, remarks: remarkParts.join(',').trim() },
  };
}

// Texas bounding box (with small buffer for border storms)
const TX_BOUNDS = { west: -107.0, south: 25.5, east: -93.0, north: 37.0 };

function isInTexas(lat, lng) {
  return lat >= TX_BOUNDS.south && lat <= TX_BOUNDS.north &&
         lng >= TX_BOUNDS.west && lng <= TX_BOUNDS.east;
}

function makeSourceId(type, time, lat, lng) {
  return crypto
    .createHash('sha256')
    .update(`${type}|${time}|${lat}|${lng}`)
    .digest('hex')
    .slice(0, 32);
}

function makeTimestamp(date, time) {
  if (!time || time.length !== 4) return null;
  const hh = parseInt(time.slice(0, 2), 10);
  const mm = parseInt(time.slice(2, 4), 10);
  if (isNaN(hh) || isNaN(mm)) return null;
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), hh, mm));
}

/**
 * Backfill SPC reports for the past N days.
 */
export async function backfillSPC(days = 30) {
  logger.info(`Backfilling SPC reports for past ${days} days`);
  let total = 0;
  const allInsertedIds = [];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const result = await ingestSPCDate(date);
    total += result.inserted;
    allInsertedIds.push(...result.insertedIds);
  }

  logger.info(`SPC backfill complete: ${total} total reports ingested`);
  return { inserted: total, insertedIds: allInsertedIds };
}
