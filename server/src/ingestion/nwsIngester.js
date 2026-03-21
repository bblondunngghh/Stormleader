import pool from '../db/pool.js';
import logger from '../utils/logger.js';

const NWS_EVENTS = [
  'Severe Thunderstorm Warning',
  'Tornado Warning',
  'Extreme Wind Warning',
];
const NWS_BASE = 'https://api.weather.gov/alerts';
const USER_AGENT = 'StormLeads/1.0 (contact: support@stormleads.io)';

// How many days back to query each ingestion run.
// Ensures we never miss expired alerts regardless of server uptime.
const NWS_LOOKBACK_DAYS = 7;

function inferEventType(props) {
  const event = (props.event || '').toLowerCase();
  if (event.includes('tornado')) return 'tornado';
  if (event.includes('wind')) return 'wind';
  if (event.includes('red flag') || event.includes('fire weather')) return 'wind';
  // Severe Thunderstorm Warnings can contain hail, wind, or both
  // Return the primary type — hazards[] tracks all threats present
  const hasHail = props.parameters?.maxHailSize?.[0] || props.parameters?.hailThreat?.[0];
  const hasWind = props.parameters?.maxWindGust?.[0] || props.parameters?.windThreat?.[0];
  if (hasHail && hasWind) return 'severe_thunderstorm';
  if (hasHail) return 'hail';
  if (hasWind) return 'wind';
  return 'severe_thunderstorm';
}

function inferHazards(props) {
  const hazards = [];
  const event = (props.event || '').toLowerCase();
  if (event.includes('tornado')) { hazards.push('tornado'); return hazards; }
  if (event.includes('wind') || event.includes('red flag') || event.includes('fire weather')) {
    hazards.push('wind');
    return hazards;
  }
  if (props.parameters?.maxHailSize?.[0] || props.parameters?.hailThreat?.[0]) hazards.push('hail');
  if (props.parameters?.maxWindGust?.[0] || props.parameters?.windThreat?.[0]) hazards.push('wind');
  if (hazards.length === 0) hazards.push('wind');
  return hazards;
}

// Zone geometry cache — avoids re-fetching the same zone in a single ingestion run
const zoneGeomCache = new Map();

/**
 * Fetch the polygon geometry for an NWS zone URL.
 * Returns a GeoJSON geometry or null.
 */
async function fetchZoneGeometry(zoneUrl) {
  if (zoneGeomCache.has(zoneUrl)) return zoneGeomCache.get(zoneUrl);

  try {
    const res = await fetch(zoneUrl, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' },
    });
    if (!res.ok) {
      zoneGeomCache.set(zoneUrl, null);
      return null;
    }
    const data = await res.json();
    const geom = data.geometry || null;
    zoneGeomCache.set(zoneUrl, geom);
    return geom;
  } catch {
    zoneGeomCache.set(zoneUrl, null);
    return null;
  }
}

/**
 * Build a merged geometry from an array of NWS zone URLs.
 * Fetches each zone polygon and merges them into a single MultiPolygon.
 */
async function resolveZoneGeometry(affectedZones) {
  if (!affectedZones || affectedZones.length === 0) return null;

  // Fetch zone geometries in parallel (batch of 10 at a time to be polite to NWS API)
  const polygons = [];
  for (let i = 0; i < affectedZones.length; i += 10) {
    const batch = affectedZones.slice(i, i + 10);
    const results = await Promise.allSettled(batch.map(url => fetchZoneGeometry(url)));
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        polygons.push(r.value);
      }
    }
  }

  if (polygons.length === 0) return null;
  if (polygons.length === 1) return polygons[0];

  // Merge all zone polygons into a single MultiPolygon
  const allCoords = [];
  for (const geom of polygons) {
    if (geom.type === 'Polygon') {
      allCoords.push(geom.coordinates);
    } else if (geom.type === 'MultiPolygon') {
      allCoords.push(...geom.coordinates);
    }
  }
  return { type: 'MultiPolygon', coordinates: allCoords };
}

// Texas bounding box for clipping
const TX_CLIP = `ST_MakeEnvelope(-106.65, 25.84, -93.51, 36.50, 4326)`;

export async function ingestNWS() {
  logger.info('Starting NWS alert ingestion');
  zoneGeomCache.clear();

  // Query the last N days of alerts (active + expired) so nothing is missed
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - NWS_LOOKBACK_DAYS);
  const startISO = start.toISOString();
  const endISO = end.toISOString();

  const responses = await Promise.allSettled(
    NWS_EVENTS.map(async (event) => {
      const url = `${NWS_BASE}?event=${encodeURIComponent(event)}&area=TX&start=${startISO}&end=${endISO}&limit=500`;
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' },
      });
      if (!res.ok) {
        logger.warn(`NWS API returned ${res.status} for event type: ${event}`);
        return [];
      }
      const data = await res.json();
      return data.features || [];
    })
  );

  // Deduplicate by alert ID across event types
  const seen = new Set();
  const features = [];
  for (const result of responses) {
    if (result.status !== 'fulfilled') continue;
    for (const f of result.value) {
      const alertId = f.properties?.id || f.properties?.['@id'];
      if (alertId && !seen.has(alertId)) {
        seen.add(alertId);
        features.push(f);
      }
    }
  }
  logger.info(`Fetched ${features.length} NWS alerts across ${NWS_EVENTS.length} event types`);

  // Collect all alert IDs to check which ones already exist in the DB
  const alertIds = features
    .map(f => f.properties?.id || f.properties?.['@id'])
    .filter(Boolean);
  const existingIds = new Set();
  if (alertIds.length > 0) {
    const { rows } = await pool.query(
      `SELECT source_id FROM storm_events WHERE source = 'nws_alert' AND source_id = ANY($1)`,
      [alertIds]
    );
    for (const r of rows) existingIds.add(r.source_id);
  }
  logger.info(`${existingIds.size} of ${alertIds.length} alerts already in DB — skipping those`);

  let inserted = 0;
  const insertedIds = [];
  let skippedNoGeom = 0;
  let skippedExisting = 0;
  for (const feature of features) {
    const props = feature.properties || {};
    const alertId = props.id || props['@id'];
    if (!alertId) continue;

    // Skip alerts we already have — no need to re-resolve zones and re-upsert
    if (existingIds.has(alertId)) {
      skippedExisting++;
      continue;
    }

    // Get geometry: inline polygon, or resolve from affected zones
    let geometry = feature.geometry;
    if (!geometry && props.affectedZones?.length > 0) {
      logger.info(`Resolving zone geometry for ${props.event} (${props.affectedZones.length} zones)`);
      geometry = await resolveZoneGeometry(props.affectedZones);
    }
    if (!geometry) {
      skippedNoGeom++;
      continue;
    }

    const geojson = JSON.stringify(geometry);
    const hailMatch = (props.parameters?.maxHailSize || props.parameters?.hailSize || [])[0];
    const windMatch = (props.parameters?.maxWindGust || props.parameters?.windSpeed || [])[0];

    const hailParsed = hailMatch ? parseFloat(hailMatch) : NaN;
    const hailSize = Number.isFinite(hailParsed) ? hailParsed : null;
    // maxWindGust comes as "60 MPH" or "Up to 50 MPH" — extract the number
    let windParsed = windMatch ? parseFloat(windMatch.replace(/[^0-9.]/g, ' ').trim().split(/\s+/).pop()) : NaN;
    // For Red Flag Warnings / Fire Weather: parse wind from description text
    // e.g. "WINDS...North 15 to 25 mph with gusts to 40 to 45 mph."
    if (!Number.isFinite(windParsed) && props.description) {
      const gustMatch = props.description.match(/gusts?\s+(?:of\s+|to\s+)?(\d+)\s*(?:to\s+(\d+))?\s*mph/i);
      if (gustMatch) {
        windParsed = parseFloat(gustMatch[2] || gustMatch[1]);
      } else {
        const windTextMatch = props.description.match(/winds?[.\s]+\w+\s+(\d+)\s+to\s+(\d+)\s*mph/i);
        if (windTextMatch) windParsed = parseFloat(windTextMatch[2]);
      }
    }
    const windSpeed = Number.isFinite(windParsed) ? windParsed : null;

    // ST_MakeValid can produce GeometryCollections — extract only polygons and re-merge
    const geomSQL = `ST_Simplify(
      ST_Multi(ST_CollectionExtract(
        ST_Intersection(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)), ${TX_CLIP}),
        3
      )),
      0.001
    )`;

    try {
      const { rows: insertedRows, rowCount } = await pool.query(
        `INSERT INTO storm_events (source, source_id, geom, hail_size_max_in, wind_speed_max_mph, event_start, event_end, raw_data)
         VALUES ('nws_alert', $1, ${geomSQL}, $3, $4, $5, $6, $7)
         ON CONFLICT (source, source_id) DO UPDATE SET
           geom = EXCLUDED.geom,
           hail_size_max_in = COALESCE(EXCLUDED.hail_size_max_in, storm_events.hail_size_max_in),
           wind_speed_max_mph = COALESCE(EXCLUDED.wind_speed_max_mph, storm_events.wind_speed_max_mph),
           raw_data = EXCLUDED.raw_data
         RETURNING id`,
        [
          alertId,
          geojson,
          hailSize,
          windSpeed,
          props.onset || props.sent,
          props.expires,
          JSON.stringify({
            event: props.event,
            type: inferEventType(props),
            hazards: inferHazards(props),
            headline: props.headline,
            severity: props.severity,
            certainty: props.certainty,
            areaDesc: props.areaDesc,
            maxWindGust: (props.parameters?.maxWindGust || [])[0] || null,
            maxHailSize: (props.parameters?.maxHailSize || [])[0] || null,
            windThreat: (props.parameters?.windThreat || [])[0] || null,
            hailThreat: (props.parameters?.hailThreat || [])[0] || null,
          }),
        ]
      );
      inserted += rowCount;
      if (insertedRows.length > 0) insertedIds.push(insertedRows[0].id);
    } catch (err) {
      logger.error({ err, alertId, event: props.event }, 'Failed to insert NWS alert');
    }
  }

  if (skippedNoGeom > 0) {
    logger.warn(`NWS ingestion: skipped ${skippedNoGeom} alerts with no resolvable geometry`);
  }
  logger.info(`NWS ingestion complete: ${inserted} new, ${skippedExisting} already existed, ${skippedNoGeom} no geometry`);
  return { inserted, insertedIds };
}

