import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import env from '../config/env.js';

const GOOGLE_SOLAR_KEY = env.GOOGLE_SOLAR_API_KEY || '';

/**
 * Measure a roof using Google Solar API.
 * Fetches building insights, parses roof segments, updates property, logs usage.
 */
export async function measureRoof(tenantId, propertyId) {
  if (!GOOGLE_SOLAR_KEY) {
    throw new Error('GOOGLE_SOLAR_API_KEY is not configured');
  }

  // Get property lat/lng from PostGIS geometry
  const { rows: propRows } = await pool.query(
    `SELECT ST_AsGeoJSON(location)::json AS geojson FROM properties WHERE id = $1`,
    [propertyId]
  );

  if (propRows.length === 0) {
    throw new Error('Property not found');
  }

  const geojson = propRows[0].geojson;
  if (!geojson || geojson.type !== 'Point') {
    throw new Error('Property has no valid location geometry');
  }

  const [lng, lat] = geojson.coordinates;

  // Call Google Solar API
  const url = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&key=${GOOGLE_SOLAR_KEY}`;
  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    logger.error({ status: response.status, body: errorText }, 'Google Solar API error');
    if (response.status === 404) {
      throw new Error('No roof data available for this location. Google Solar may not have imagery for this address.');
    }
    throw new Error(`Google Solar API returned ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const segments = data.solarPotential?.roofSegmentStats || [];

  if (segments.length === 0) {
    throw new Error('No roof segment data returned from Google Solar API');
  }

  // Sum segment area and convert m2 to sqft
  // Google Solar API uses stats.areaMeters2 for each segment
  const totalAreaM2 = segments.reduce((sum, seg) => sum + (seg.stats?.areaMeters2 || 0), 0);
  const roofSqft = Math.round(totalAreaM2 * 10.7639);

  // Weighted average pitch
  let avgPitch = 0;
  if (totalAreaM2 > 0) {
    avgPitch = segments.reduce((sum, seg) => {
      const weight = (seg.stats?.areaMeters2 || 0) / totalAreaM2;
      return sum + (seg.pitchDegrees || 0) * weight;
    }, 0);
    avgPitch = Math.round(avgPitch * 100) / 100;
  }

  const roofSegments = segments.length;

  // Update property with roof measurement data
  await pool.query(
    `UPDATE properties
     SET roof_sqft = $1, roof_pitch_degrees = $2, roof_segments = $3, roof_measurement_source = 'google_solar'
     WHERE id = $4`,
    [roofSqft, avgPitch, roofSegments, propertyId]
  );

  // Insert usage record
  await pool.query(
    `INSERT INTO roof_measurement_usage (tenant_id, property_id, roof_sqft, roof_segments, avg_pitch_degrees, cost_cents, raw_response)
     VALUES ($1, $2, $3, $4, $5, 10, $6)`,
    [tenantId, propertyId, roofSqft, roofSegments, avgPitch, JSON.stringify(data)]
  );

  logger.info({ tenantId, propertyId, roofSqft, roofSegments, avgPitch }, 'Roof measurement completed');

  return { roof_sqft: roofSqft, roof_pitch_degrees: avgPitch, roof_segments: roofSegments, source: 'google_solar' };
}

/**
 * Get roof measurement usage stats for a tenant.
 */
export async function getUsage(tenantId) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) as total_measurements,
       COALESCE(SUM(cost_cents), 0) as total_cost_cents
     FROM roof_measurement_usage
     WHERE tenant_id = $1`,
    [tenantId]
  );
  return rows[0];
}

/**
 * Get unbilled roof measurement balance for a tenant.
 */
export async function getBalance(tenantId) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) as unbilled_measurements,
       COALESCE(SUM(cost_cents), 0) as unbilled_cents
     FROM roof_measurement_usage
     WHERE tenant_id = $1 AND billed = false`,
    [tenantId]
  );
  return rows[0];
}
