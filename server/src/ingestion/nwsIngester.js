import pool from '../db/pool.js';
import logger from '../utils/logger.js';

const NWS_URL = 'https://api.weather.gov/alerts/active?event=Severe%20Thunderstorm%20Warning';
const USER_AGENT = 'StormLeads/1.0 (contact: support@stormleads.io)';

export async function ingestNWS() {
  logger.info('Starting NWS alert ingestion');

  const response = await fetch(NWS_URL, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' },
  });

  if (!response.ok) {
    throw new Error(`NWS API returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const features = data.features || [];
  logger.info(`Fetched ${features.length} NWS alerts`);

  let inserted = 0;
  for (const feature of features) {
    const props = feature.properties || {};
    const alertId = props.id || props['@id'];
    if (!alertId) continue;

    // NWS alerts can have geometry directly or in a separate polygon property
    let geometry = feature.geometry;
    if (!geometry && props.geocode) {
      // Skip alerts without polygon geometry
      continue;
    }
    if (!geometry) continue;

    const geojson = JSON.stringify(geometry);
    const hailMatch = (props.parameters?.hailSize || [])[0];
    const windMatch = (props.parameters?.windSpeed || [])[0];

    const hailSize = hailMatch ? parseFloat(hailMatch) : null;
    const windSpeed = windMatch ? parseFloat(windMatch) : null;

    const { rowCount } = await pool.query(
      `INSERT INTO storm_events (source, source_id, geom, hail_size_max_in, wind_speed_max_mph, event_start, event_end, raw_data)
       VALUES ('nws_alert', $1, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), $3, $4, $5, $6, $7)
       ON CONFLICT (source, source_id) DO NOTHING`,
      [
        alertId,
        geojson,
        hailSize,
        windSpeed,
        props.onset || props.sent,
        props.expires,
        JSON.stringify({
          headline: props.headline,
          severity: props.severity,
          certainty: props.certainty,
          areaDesc: props.areaDesc,
        }),
      ]
    );
    inserted += rowCount;
  }

  logger.info(`NWS ingestion complete: ${inserted} new alerts inserted`);
}
