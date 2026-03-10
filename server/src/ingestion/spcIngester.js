import crypto from 'crypto';
import pool from '../db/pool.js';
import logger from '../utils/logger.js';

const SPC_HAIL_URL = 'https://www.spc.noaa.gov/climo/reports/today_hail.csv';
const SPC_WIND_URL = 'https://www.spc.noaa.gov/climo/reports/today_wind.csv';

function parseEventStart(time) {
  if (!time || time.length !== 4) return null;
  const now = new Date();
  const hh = parseInt(time.slice(0, 2), 10);
  const mm = parseInt(time.slice(2, 4), 10);
  if (isNaN(hh) || isNaN(mm)) return null;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hh, mm));
}

// Texas bounding box (with small buffer for border storms)
const TX_BOUNDS = { west: -107.0, south: 25.5, east: -93.0, north: 37.0 };

function isInTexas(lat, lng) {
  return lat >= TX_BOUNDS.south && lat <= TX_BOUNDS.north &&
         lng >= TX_BOUNDS.west && lng <= TX_BOUNDS.east;
}

function parseCoords(latStr, lonStr) {
  const latitude = parseFloat(latStr);
  const longitude = parseFloat(lonStr);
  if (isNaN(latitude) || isNaN(longitude)) return null;
  // Negate longitude if positive (SPC reports Western Hemisphere as positive)
  const lng = longitude > 0 ? -longitude : longitude;
  return { latitude, lng };
}

function makeSourceId(time, latitude, lng) {
  return crypto
    .createHash('sha256')
    .update(`${time}|${latitude}|${lng}`)
    .digest('hex')
    .slice(0, 32);
}

async function ingestHail() {
  logger.info('Starting SPC hail report ingestion');

  const response = await fetch(SPC_HAIL_URL);
  if (!response.ok) {
    throw new Error(`SPC hail returned ${response.status}: ${response.statusText}`);
  }

  const text = await response.text();
  const lines = text.trim().split('\n');

  // CSV columns: Time,Size,Location,County,State,Lat,Lon,Remarks
  const startIdx = lines[0].toLowerCase().includes('time') ? 1 : 0;

  let inserted = 0;
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',');
    if (parts.length < 7) continue;

    const [time, size, location, county, state, lat, lon, ...remarkParts] = parts;
    const coords = parseCoords(lat, lon);
    if (!coords) continue;
    if (!isInTexas(coords.latitude, coords.lng)) continue;

    const hailSize = parseFloat(size) / 100;
    const sourceId = makeSourceId(time, coords.latitude, coords.lng);
    const remarks = remarkParts.join(',').trim();
    const geojson = JSON.stringify({ type: 'Point', coordinates: [coords.lng, coords.latitude] });
    const eventStart = parseEventStart(time);

    const { rowCount } = await pool.query(
      `INSERT INTO storm_events (source, source_id, geom, hail_size_max_in, event_start, raw_data)
       VALUES ('spc_report', $1, ST_Simplify(ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), 0.0001), $3, $4, $5)
       ON CONFLICT (source, source_id) DO NOTHING`,
      [
        sourceId,
        geojson,
        isNaN(hailSize) ? null : hailSize,
        eventStart,
        JSON.stringify({ type: 'hail', location, county, state, remarks }),
      ]
    );
    inserted += rowCount;
  }

  logger.info(`SPC hail ingestion complete: ${inserted} new reports inserted`);
  return inserted;
}

async function ingestWind() {
  logger.info('Starting SPC wind report ingestion');

  const response = await fetch(SPC_WIND_URL);
  if (!response.ok) {
    throw new Error(`SPC wind returned ${response.status}: ${response.statusText}`);
  }

  const text = await response.text();
  const lines = text.trim().split('\n');

  // CSV columns: Time,Speed,Location,County,State,Lat,Lon,Remarks
  const startIdx = lines[0].toLowerCase().includes('time') ? 1 : 0;

  let inserted = 0;
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',');
    if (parts.length < 7) continue;

    const [time, speed, location, county, state, lat, lon, ...remarkParts] = parts;
    const coords = parseCoords(lat, lon);
    if (!coords) continue;
    if (!isInTexas(coords.latitude, coords.lng)) continue;

    const windSpeed = parseFloat(speed);
    const sourceId = makeSourceId(`wind_${time}`, coords.latitude, coords.lng);
    const remarks = remarkParts.join(',').trim();
    const geojson = JSON.stringify({ type: 'Point', coordinates: [coords.lng, coords.latitude] });
    const eventStart = parseEventStart(time);

    const { rowCount } = await pool.query(
      `INSERT INTO storm_events (source, source_id, geom, wind_speed_max_mph, event_start, raw_data)
       VALUES ('spc_report', $1, ST_Simplify(ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), 0.0001), $3, $4, $5)
       ON CONFLICT (source, source_id) DO NOTHING`,
      [
        sourceId,
        geojson,
        isNaN(windSpeed) || windSpeed <= 0 ? null : windSpeed,
        eventStart,
        JSON.stringify({ type: 'wind', speed: isNaN(windSpeed) ? 'UNK' : windSpeed, location, county, state, remarks }),
      ]
    );
    inserted += rowCount;
  }

  logger.info(`SPC wind ingestion complete: ${inserted} new reports inserted`);
  return inserted;
}

export async function ingestSPC() {
  const hailCount = await ingestHail();
  const windCount = await ingestWind();
  return { hail: hailCount, wind: windCount };
}
