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

      let inserted = 0;
      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const event = parseRow(line, date);
        if (!event) continue;

        // Insert as a buffered polygon (estimated damage area) instead of a point
        // Buffer radius in meters: hail scales by size, wind ~500m, tornado ~600m
        const bufferMeters = event.rawData.type === 'hail'
          ? Math.max(800, (event.hailSize || 1) * 800)
          : event.rawData.type === 'tornado' ? 600 : 500;

        const { rowCount } = await pool.query(
          `INSERT INTO storm_events (source, source_id, geom, hail_size_max_in, wind_speed_max_mph, event_start, raw_data)
           VALUES ($1, $2,
             ST_Buffer(ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)::geography, $8)::geometry,
             $4, $5, $6, $7)
           ON CONFLICT (source, source_id) DO NOTHING`,
          [event.source, event.sourceId, event.geojson, event.hailSize, event.windSpeed, event.eventStart, JSON.stringify(event.rawData), bufferMeters]
        );
        inserted += rowCount;
      }
      if (inserted > 0) {
        logger.info(`Ingested ${inserted} reports from ${file}`);
      }
      totalInserted += inserted;
    } catch (err) {
      logger.error({ err }, `Failed to ingest ${file}`);
    }
  }

  return totalInserted;
}

function parseHailRow(line, date) {
  const parts = line.split(',');
  if (parts.length < 7) return null;

  const [time, size, location, county, state, lat, lon, ...remarkParts] = parts;
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);
  if (isNaN(latitude) || isNaN(longitude)) return null;

  const lng = longitude > 0 ? -longitude : longitude;
  const hailSize = parseFloat(size) / 100;

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
  const windMph = speed === 'UNK' ? null : parseFloat(speed);

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
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const count = await ingestSPCDate(date);
    total += count;
  }

  logger.info(`SPC backfill complete: ${total} total reports ingested`);
  return total;
}
