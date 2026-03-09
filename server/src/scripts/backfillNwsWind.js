import pool from '../db/pool.js';
import logger from '../utils/logger.js';

const USER_AGENT = 'StormLeads/1.0 (contact: support@stormleads.io)';
const BATCH_SIZE = 50;
const DELAY_MS = 200; // be nice to the NWS API

async function backfill() {
  const { rows } = await pool.query(
    `SELECT id, source_id, raw_data FROM storm_events
     WHERE source = 'nws_alert' AND wind_speed_max_mph IS NULL
     ORDER BY event_start DESC NULLS LAST`
  );

  logger.info(`Found ${rows.length} NWS alerts to backfill`);

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const url = `https://api.weather.gov/alerts/${encodeURIComponent(row.source_id)}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' },
      });

      if (!res.ok) {
        if (res.status === 404) continue; // alert expired/gone
        logger.warn(`NWS ${res.status} for ${row.source_id}`);
        failed++;
        continue;
      }

      const data = await res.json();
      const p = data.properties || {};

      const maxWindGust = (p.parameters?.maxWindGust || [])[0] || null;
      const maxHailSize = (p.parameters?.maxHailSize || [])[0] || null;
      const windThreat = (p.parameters?.windThreat || [])[0] || null;
      const hailThreat = (p.parameters?.hailThreat || [])[0] || null;

      // "60 MPH" or "Up to 50 MPH" — extract the number
      const windSpeed = maxWindGust ? parseFloat(maxWindGust.replace(/[^0-9.]/g, ' ').trim().split(/\s+/).pop()) : null;
      const hailSize = maxHailSize ? parseFloat(maxHailSize) : null;

      // Merge new fields into existing raw_data
      const rawData = {
        ...(row.raw_data || {}),
        maxWindGust,
        maxHailSize,
        windThreat,
        hailThreat,
      };

      await pool.query(
        `UPDATE storm_events SET
           wind_speed_max_mph = COALESCE($2, wind_speed_max_mph),
           hail_size_max_in = COALESCE($3, hail_size_max_in),
           raw_data = $4
         WHERE id = $1`,
        [row.id, windSpeed, hailSize, JSON.stringify(rawData)]
      );

      updated++;
      if (updated % 50 === 0) {
        logger.info(`Backfilled ${updated}/${rows.length} (${failed} failed)`);
      }

      // Rate limit
      if (i % BATCH_SIZE === 0 && i > 0) {
        await new Promise(r => setTimeout(r, DELAY_MS));
      }
    } catch (err) {
      logger.error({ err, sourceId: row.source_id }, 'Backfill error');
      failed++;
    }
  }

  logger.info(`Backfill complete: ${updated} updated, ${failed} failed out of ${rows.length}`);
  await pool.end();
}

backfill().catch(err => {
  logger.error({ err }, 'Backfill script failed');
  process.exit(1);
});
