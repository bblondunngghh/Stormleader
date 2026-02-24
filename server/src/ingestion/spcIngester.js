import crypto from 'crypto';
import pool from '../db/pool.js';
import logger from '../utils/logger.js';

const SPC_URL = 'https://www.spc.noaa.gov/climo/reports/today_hail.csv';

export async function ingestSPC() {
  logger.info('Starting SPC hail report ingestion');

  const response = await fetch(SPC_URL);
  if (!response.ok) {
    throw new Error(`SPC returned ${response.status}: ${response.statusText}`);
  }

  const text = await response.text();
  const lines = text.trim().split('\n');

  // CSV columns: Time,Speed,Location,County,State,Lat,Lon,Remarks
  // First line may be a header
  const startIdx = lines[0].toLowerCase().includes('time') ? 1 : 0;

  let inserted = 0;
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',');
    if (parts.length < 7) continue;

    const [time, size, location, county, state, lat, lon, ...remarkParts] = parts;
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (isNaN(latitude) || isNaN(longitude)) continue;

    // Negate longitude if positive (SPC reports Western Hemisphere as positive)
    const lng = longitude > 0 ? -longitude : longitude;

    // Hail size is in the Speed/Size column (hundredths of inch)
    const hailSize = parseFloat(size) / 100;

    // Generate a deterministic source_id from time + location
    const sourceId = crypto
      .createHash('sha256')
      .update(`${time}|${latitude}|${lng}`)
      .digest('hex')
      .slice(0, 32);

    const remarks = remarkParts.join(',').trim();
    const geojson = JSON.stringify({ type: 'Point', coordinates: [lng, latitude] });

    // Build a rough event_start from today's date + report time (HHMM)
    let eventStart = null;
    if (time && time.length === 4) {
      const now = new Date();
      const hh = parseInt(time.slice(0, 2), 10);
      const mm = parseInt(time.slice(2, 4), 10);
      if (!isNaN(hh) && !isNaN(mm)) {
        eventStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hh, mm));
      }
    }

    const { rowCount } = await pool.query(
      `INSERT INTO storm_events (source, source_id, geom, hail_size_max_in, event_start, raw_data)
       VALUES ('spc_report', $1, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), $3, $4, $5)
       ON CONFLICT (source, source_id) DO NOTHING`,
      [
        sourceId,
        geojson,
        isNaN(hailSize) ? null : hailSize,
        eventStart,
        JSON.stringify({ location, county, state, remarks }),
      ]
    );
    inserted += rowCount;
  }

  logger.info(`SPC ingestion complete: ${inserted} new hail reports inserted`);
}
