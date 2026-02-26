import pool from '../db/pool.js';
import logger from '../utils/logger.js';

// Physical constants
const GRAVITY = 9.81;            // m/s²
const AIR_DENSITY_SL = 1.225;    // kg/m³ at sea level
const ICE_DENSITY = 917;         // kg/m³
const DRAG_COEFF = 0.5;          // sphere drag coefficient for hail
const METERS_PER_DEGREE_LAT = 111320;

// HRRR pressure levels (mb) and their approximate altitudes (m ASL)
const PRESSURE_LEVELS = [
  { mb: 1000, alt_m: 110 },
  { mb: 975,  alt_m: 330 },
  { mb: 950,  alt_m: 550 },
  { mb: 925,  alt_m: 770 },
  { mb: 900,  alt_m: 1000 },
  { mb: 850,  alt_m: 1460 },
  { mb: 800,  alt_m: 1950 },
  { mb: 750,  alt_m: 2470 },
  { mb: 700,  alt_m: 3010 },
  { mb: 650,  alt_m: 3600 },
  { mb: 600,  alt_m: 4210 },
  { mb: 550,  alt_m: 4870 },
  { mb: 500,  alt_m: 5570 },
  { mb: 450,  alt_m: 6340 },
  { mb: 400,  alt_m: 7180 },
];

/**
 * Fetch wind profile from NOAA HRRR model at a given location and time.
 * Uses the NOMADS HRRR GRIB filter API (free, no auth).
 *
 * Returns wind vectors at multiple altitude layers.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {Date} time - Event time (finds nearest HRRR cycle)
 * @returns {Array<{alt_m: number, u_ms: number, v_ms: number}>} Wind profile
 */
export async function fetchHRRRWindProfile(lat, lng, time) {
  // Find nearest HRRR cycle (runs hourly, available ~1hr after)
  const cycleDate = new Date(time);
  cycleDate.setUTCMinutes(0, 0, 0);
  const cycleHour = cycleDate.getUTCHours();

  const dateStr = cycleDate.toISOString().slice(0, 10).replace(/-/g, '');
  const hourStr = String(cycleHour).padStart(2, '0');

  // NOMADS HRRR GRIB filter — request U and V wind at pressure levels near our point
  // This gives us a small subset of the GRIB file via the filter service
  const baseUrl = 'https://nomads.ncep.noaa.gov/cgi-bin/filter_hrrr_2d.pl';

  // For the sounding, we need 3D pressure level data from the HRRR pressure file
  const pressureUrl = `https://nomads.ncep.noaa.gov/cgi-bin/filter_hrrr_sub.pl`;

  // Build request for U and V wind components at all pressure levels
  const levelsParam = PRESSURE_LEVELS.map(l => `&lev_${l.mb}_mb=on`).join('');

  const params = new URLSearchParams({
    file: `hrrr.t${hourStr}z.wrfprsf00.grib2`,
    var_UGRD: 'on',
    var_VGRD: 'on',
    subregion: '',
    leftlon: String(lng - 0.5),
    rightlon: String(lng + 0.5),
    toplat: String(lat + 0.5),
    bottomlat: String(lat - 0.5),
    dir: `/hrrr.${dateStr}/conus`,
  });

  // Add pressure levels
  for (const l of PRESSURE_LEVELS) {
    params.append(`lev_${l.mb}_mb`, 'on');
  }

  try {
    const url = `${pressureUrl}?${params.toString()}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });

    if (!res.ok) {
      logger.warn({ status: res.status, dateStr, hourStr },
        'HRRR data not available, using climatological wind profile');
      return getClimatologicalProfile(lat, lng, time);
    }

    // HRRR returns GRIB2 data — parsing it fully requires a GRIB2 library
    // For now, use the fallback climatological profile
    // TODO: Integrate wgrib2 or eccodes for proper GRIB2 parsing
    logger.info('HRRR data fetched but GRIB2 parsing not yet available, using climatological profile');
    return getClimatologicalProfile(lat, lng, time);

  } catch (err) {
    logger.warn({ err: err.message }, 'HRRR fetch failed, using climatological profile');
    return getClimatologicalProfile(lat, lng, time);
  }
}

/**
 * Climatological wind profile approximation based on location and season.
 * Uses typical mid-latitude wind shear profile for the Central US.
 *
 * This is a reasonable default when HRRR data isn't available.
 * Central TX typical storm environment: SW winds aloft, backed to SE near surface.
 */
function getClimatologicalProfile(lat, lng, time) {
  const month = time ? new Date(time).getUTCMonth() : 5; // default to June

  // Seasonal wind speed multiplier (stronger in spring storm season)
  const seasonalMultiplier = [0.8, 0.9, 1.0, 1.1, 1.15, 1.1, 1.0, 0.95, 0.9, 0.85, 0.8, 0.75][month];

  // Typical Central US severe storm environment wind profile
  // Surface: light SE, increasing and veering to SW with altitude
  const profile = [
    { alt_m: 110,  u_ms: -2 * seasonalMultiplier, v_ms: 4 * seasonalMultiplier },   // ~SE
    { alt_m: 330,  u_ms: -1 * seasonalMultiplier, v_ms: 5 * seasonalMultiplier },
    { alt_m: 550,  u_ms: 0,                       v_ms: 6 * seasonalMultiplier },
    { alt_m: 770,  u_ms: 2 * seasonalMultiplier,  v_ms: 7 * seasonalMultiplier },
    { alt_m: 1000, u_ms: 4 * seasonalMultiplier,  v_ms: 8 * seasonalMultiplier },   // ~SSW
    { alt_m: 1460, u_ms: 6 * seasonalMultiplier,  v_ms: 9 * seasonalMultiplier },
    { alt_m: 1950, u_ms: 8 * seasonalMultiplier,  v_ms: 10 * seasonalMultiplier },
    { alt_m: 2470, u_ms: 10 * seasonalMultiplier, v_ms: 10 * seasonalMultiplier },  // ~WSW
    { alt_m: 3010, u_ms: 12 * seasonalMultiplier, v_ms: 10 * seasonalMultiplier },
    { alt_m: 3600, u_ms: 14 * seasonalMultiplier, v_ms: 9 * seasonalMultiplier },
    { alt_m: 4210, u_ms: 16 * seasonalMultiplier, v_ms: 8 * seasonalMultiplier },   // ~W
    { alt_m: 4870, u_ms: 18 * seasonalMultiplier, v_ms: 7 * seasonalMultiplier },
    { alt_m: 5570, u_ms: 20 * seasonalMultiplier, v_ms: 6 * seasonalMultiplier },
    { alt_m: 6340, u_ms: 22 * seasonalMultiplier, v_ms: 5 * seasonalMultiplier },
    { alt_m: 7180, u_ms: 24 * seasonalMultiplier, v_ms: 4 * seasonalMultiplier },   // ~WNW
  ];

  return profile;
}

/**
 * Calculate terminal velocity of a hailstone.
 *
 * v_t = sqrt((2 * m * g) / (ρ_air * A * Cd))
 *
 * @param {number} diameterInches - Hail diameter in inches
 * @param {number} altitudeM - Altitude in meters (affects air density)
 * @returns {number} Terminal velocity in m/s
 */
function terminalVelocity(diameterInches, altitudeM = 0) {
  const radius = (diameterInches * 0.0254) / 2; // Convert inches to meters radius
  const volume = (4 / 3) * Math.PI * Math.pow(radius, 3);
  const mass = ICE_DENSITY * volume;
  const area = Math.PI * Math.pow(radius, 2);

  // Air density decreases with altitude (barometric formula approximation)
  const airDensity = AIR_DENSITY_SL * Math.exp(-altitudeM / 8500);

  return Math.sqrt((2 * mass * GRAVITY) / (airDensity * area * DRAG_COEFF));
}

/**
 * Calculate hail drift displacement using ballistic trajectory through wind profile.
 *
 * Steps the hailstone down through altitude layers, applying wind at each layer.
 *
 * @param {number} hailSizeIn - Hail diameter in inches
 * @param {Array} windProfile - Wind vectors at altitude layers
 * @param {number} detectionAltM - Altitude where hail was detected (meters)
 * @returns {{ dx_m: number, dy_m: number, fall_time_s: number }}
 */
export function calculateDrift(hailSizeIn, windProfile, detectionAltM = 5500) {
  if (!hailSizeIn || hailSizeIn <= 0 || !windProfile || windProfile.length === 0) {
    return { dx_m: 0, dy_m: 0, fall_time_s: 0 };
  }

  // Sort profile by altitude descending (we fall from top to bottom)
  const sorted = [...windProfile]
    .filter(l => l.alt_m <= detectionAltM)
    .sort((a, b) => b.alt_m - a.alt_m);

  if (sorted.length === 0) {
    return { dx_m: 0, dy_m: 0, fall_time_s: 0 };
  }

  let totalDx = 0; // East-west displacement (meters), positive = east
  let totalDy = 0; // North-south displacement (meters), positive = north
  let totalTime = 0;
  let currentAlt = detectionAltM;

  for (let i = 0; i < sorted.length; i++) {
    const layer = sorted[i];
    const nextAlt = (i + 1 < sorted.length) ? sorted[i + 1].alt_m : 0;
    const fallDistance = currentAlt - nextAlt;

    if (fallDistance <= 0) continue;

    // Terminal velocity at the midpoint of this layer
    const midAlt = (currentAlt + nextAlt) / 2;
    const vTerm = terminalVelocity(hailSizeIn, midAlt);

    // Time to fall through this layer
    const fallTime = fallDistance / vTerm;

    // Wind displacement during this time
    totalDx += layer.u_ms * fallTime;
    totalDy += layer.v_ms * fallTime;
    totalTime += fallTime;

    currentAlt = nextAlt;
  }

  // If we still have altitude left to the ground (below lowest wind layer)
  if (currentAlt > 0) {
    const vTerm = terminalVelocity(hailSizeIn, currentAlt / 2);
    const fallTime = currentAlt / vTerm;
    // Use the lowest layer's wind for the remaining fall
    const lowestWind = sorted[sorted.length - 1] || { u_ms: 0, v_ms: 0 };
    totalDx += lowestWind.u_ms * fallTime;
    totalDy += lowestWind.v_ms * fallTime;
    totalTime += fallTime;
  }

  return {
    dx_m: Math.round(totalDx),
    dy_m: Math.round(totalDy),
    fall_time_s: Math.round(totalTime),
    detection_alt_m: detectionAltM,
  };
}

/**
 * Apply wind drift correction to a storm event's geometry.
 * Shifts the polygon by the calculated displacement vector.
 *
 * @param {string} stormEventId - UUID of the storm event
 * @param {object} [options]
 * @param {number} [options.detectionAltM=5500] - Detection altitude
 */
export async function applyDriftCorrection(stormEventId, options = {}) {
  const detectionAltM = options.detectionAltM || 5500;

  // Get the storm event
  const { rows: [event] } = await pool.query(`
    SELECT id, hail_size_max_in, event_start,
           ST_Y(ST_Centroid(geom)) as lat,
           ST_X(ST_Centroid(geom)) as lng
    FROM storm_events WHERE id = $1
  `, [stormEventId]);

  if (!event) throw new Error(`Storm event ${stormEventId} not found`);
  if (!event.hail_size_max_in) {
    logger.info({ stormEventId }, 'No hail size, skipping drift correction');
    return null;
  }

  // Fetch wind profile
  const windProfile = await fetchHRRRWindProfile(event.lat, event.lng, event.event_start);

  // Calculate displacement
  const drift = calculateDrift(event.hail_size_max_in, windProfile, detectionAltM);

  if (drift.dx_m === 0 && drift.dy_m === 0) {
    logger.info({ stormEventId }, 'Zero drift calculated, skipping');
    return drift;
  }

  // Convert meters to degrees for the translation
  const dLng = drift.dx_m / (METERS_PER_DEGREE_LAT * Math.cos(event.lat * Math.PI / 180));
  const dLat = drift.dy_m / METERS_PER_DEGREE_LAT;

  // Apply the translation to the geometry using ST_Translate
  await pool.query(`
    UPDATE storm_events
    SET drift_corrected_geom = ST_Translate(geom, $2, $3),
        drift_vector_m = $4
    WHERE id = $1
  `, [stormEventId, dLng, dLat, JSON.stringify(drift)]);

  logger.info({
    stormEventId,
    dx_m: drift.dx_m,
    dy_m: drift.dy_m,
    fall_time_s: drift.fall_time_s,
    hailSize: event.hail_size_max_in,
  }, 'Drift correction applied');

  return drift;
}

/**
 * Apply drift correction to all uncorrected hail events.
 */
export async function correctAllPending() {
  const { rows } = await pool.query(`
    SELECT id FROM storm_events
    WHERE hail_size_max_in IS NOT NULL
      AND hail_size_max_in > 0
      AND drift_corrected_geom IS NULL
    ORDER BY event_start DESC NULLS LAST
    LIMIT 500
  `);

  logger.info(`Applying drift correction to ${rows.length} storm events`);
  let corrected = 0;

  for (const row of rows) {
    try {
      await applyDriftCorrection(row.id);
      corrected++;
    } catch (err) {
      logger.error({ err, stormEventId: row.id }, 'Drift correction failed');
    }
  }

  logger.info(`Drift correction complete: ${corrected}/${rows.length} events corrected`);
  return corrected;
}

/**
 * Get drift info for a storm event.
 */
export async function getDriftInfo(stormEventId) {
  const { rows: [event] } = await pool.query(`
    SELECT id, hail_size_max_in,
           drift_vector_m,
           drift_corrected_geom IS NOT NULL as has_correction,
           ST_AsGeoJSON(drift_corrected_geom)::json as corrected_geometry
    FROM storm_events WHERE id = $1
  `, [stormEventId]);
  return event || null;
}

/**
 * Record a ground-truth damage report for calibration.
 */
export async function recordCalibration(tenantId, stormEventId, lat, lng, notes) {
  const { rows: [cal] } = await pool.query(`
    INSERT INTO drift_calibrations (tenant_id, storm_event_id, actual_damage_location, notes)
    VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5)
    RETURNING *
  `, [tenantId, stormEventId, lng, lat, notes]);

  // Calculate offset from predicted centroid
  await pool.query(`
    UPDATE drift_calibrations dc
    SET predicted_location = ST_Centroid(
          COALESCE(se.drift_corrected_geom, se.geom)
        ),
        offset_meters = ST_Distance(
          dc.actual_damage_location::geography,
          ST_Centroid(COALESCE(se.drift_corrected_geom, se.geom))::geography
        )
    FROM storm_events se
    WHERE dc.id = $1 AND se.id = dc.storm_event_id
  `, [cal.id]);

  return cal;
}
