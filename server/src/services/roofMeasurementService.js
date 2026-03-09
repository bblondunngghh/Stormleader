import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import env from '../config/env.js';

const GOOGLE_SOLAR_KEY = env.GOOGLE_SOLAR_API_KEY || '';
const M_TO_FT = 3.28084;

/**
 * Derive approximate roof edge lengths from Google Solar segment data.
 *
 * Each segment has: stats.areaMeters2, pitchDegrees, azimuthDegrees, boundingBox, center.
 * We use the bounding box to estimate segment width (along ridge/eave) and depth,
 * then calculate edge types based on segment adjacency and orientation.
 *
 * Ridge: top horizontal edge shared between two segments facing opposite directions.
 * Eave:  bottom horizontal edge (drip line) of each segment.
 * Rake:  sloped side edge of a gable end (segment edge not shared with another segment).
 * Valley: internal edge where two segments meet at an angle (not 180° apart).
 * Hip:   external edge where two segments meet at an angle on a hip roof.
 * Drip edge: eave + rake combined.
 * Flashing: valley + wall junctions (estimated).
 */
function deriveEdgeLengths(segments, totalAreaM2) {
  if (!segments.length) {
    return { ridge_ft: 0, valley_ft: 0, eave_ft: 0, rake_ft: 0, hip_ft: 0, drip_edge_ft: 0, flashing_ft: 0 };
  }

  // Parse each segment's geometry
  const parsed = segments.map(seg => {
    const areaM2 = seg.stats?.areaMeters2 || 0;
    const pitchDeg = seg.pitchDegrees || 0;
    const pitchRad = (pitchDeg * Math.PI) / 180;
    const azimuth = seg.azimuthDegrees || 0;

    // Bounding box gives approximate segment dimensions
    const bb = seg.boundingBox;
    let widthM = 0, depthM = 0;
    if (bb?.sw && bb?.ne) {
      // Approximate width (east-west) and depth (north-south) from lat/lng
      const latAvg = (bb.sw.latitude + bb.ne.latitude) / 2;
      const latScale = 111320; // meters per degree latitude
      const lngScale = 111320 * Math.cos((latAvg * Math.PI) / 180);
      widthM = Math.abs(bb.ne.longitude - bb.sw.longitude) * lngScale;
      depthM = Math.abs(bb.ne.latitude - bb.sw.latitude) * latScale;
    }

    // If bounding box unavailable, estimate from area assuming ~1.5:1 ratio
    if (widthM === 0 || depthM === 0) {
      const footprintM2 = areaM2 * Math.cos(pitchRad);
      widthM = Math.sqrt(footprintM2 * 1.5);
      depthM = footprintM2 / widthM;
    }

    // Width is along the ridge/eave direction, depth is the run (horizontal)
    // Rafter length (slope length) = depth / cos(pitch)
    const rafterLengthM = depthM / Math.cos(pitchRad);

    return { areaM2, pitchDeg, pitchRad, azimuth, widthM, depthM, rafterLengthM };
  });

  // Step 1: Find ridge pairs — segments facing ~180° apart share a ridge
  let totalRidgeM = 0;
  let totalValleyM = 0;
  let totalHipM = 0;
  let totalEaveM = 0;
  let totalRakeM = 0;

  // Build ridge pairs
  const ridgePairs = [];
  const pairedAsRidge = new Set();

  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      const azDiff = Math.abs(parsed[i].azimuth - parsed[j].azimuth);
      const normalizedDiff = azDiff > 180 ? 360 - azDiff : azDiff;
      if (normalizedDiff >= 160 && normalizedDiff <= 200) {
        ridgePairs.push([i, j]);
        pairedAsRidge.add(i);
        pairedAsRidge.add(j);
      }
    }
  }

  // Step 2: Group ridge pairs into roof sections by checking if pairs share
  // similar bounding box overlap (same ridge line = same section) or have
  // significantly different area/pitch (different section = likely gable extension)
  const roofSections = []; // Each section: { pairs: [[i,j]], segmentIndices: Set }
  const pairAssigned = new Set();

  for (let pi = 0; pi < ridgePairs.length; pi++) {
    if (pairAssigned.has(pi)) continue;
    const section = { pairs: [ridgePairs[pi]], indices: new Set(ridgePairs[pi]) };
    pairAssigned.add(pi);

    // Check if other pairs belong to the same section (overlapping bounding boxes)
    for (let pj = pi + 1; pj < ridgePairs.length; pj++) {
      if (pairAssigned.has(pj)) continue;
      const [a, b] = ridgePairs[pj];
      // If any segment is shared or bounding boxes significantly overlap, same section
      if (section.indices.has(a) || section.indices.has(b)) {
        section.pairs.push(ridgePairs[pj]);
        section.indices.add(a);
        section.indices.add(b);
        pairAssigned.add(pj);
      }
    }
    roofSections.push(section);
  }

  // If no pairs found, treat each segment individually
  if (roofSections.length === 0) {
    parsed.forEach(s => {
      roofSections.push({ pairs: [], indices: new Set(), segments: [s] });
    });
  }

  // Step 3: For each section, determine if it's a hip or gable section
  // by comparing segment areas within the section and across sections
  const largestSectionArea = Math.max(...roofSections.map(sec =>
    [...sec.indices].reduce((sum, idx) => sum + parsed[idx].areaM2, 0)
  ), 1);

  for (const section of roofSections) {
    const sectionSegments = [...section.indices].map(idx => parsed[idx]);
    const sectionArea = sectionSegments.reduce((sum, s) => sum + s.areaM2, 0);
    const isSecondarySection = sectionArea < largestSectionArea * 0.6;

    // Check if segments in this section have significantly different pitches
    const pitches = sectionSegments.map(s => s.pitchDeg);
    const avgPitch = pitches.reduce((a, b) => a + b, 0) / pitches.length;
    const hasMixedPitch = pitches.some(p => Math.abs(p - avgPitch) > 5);

    for (const [i, j] of section.pairs) {
      const si = parsed[i];
      const sj = parsed[j];
      const ridgeLen = Math.min(si.widthM, sj.widthM);
      totalRidgeM += ridgeLen;

      // Determine if this pair's non-ridge edges are hips or rakes
      // Secondary sections (garage extensions, dormers) typically have gable ends = rakes
      // Main section with 90° adjacent segments = hips
      const areaRatio = Math.min(si.areaM2, sj.areaM2) / Math.max(si.areaM2, sj.areaM2);
      const pitchDiff = Math.abs(si.pitchDeg - sj.pitchDeg);

      if (isSecondarySection || hasMixedPitch || pitchDiff > 5 || areaRatio < 0.5) {
        // Likely a gable section — side edges are rakes
        totalRakeM += si.rafterLengthM;
        totalRakeM += sj.rafterLengthM;
      }
    }
  }

  // Step 4: Each segment contributes an eave
  parsed.forEach(s => { totalEaveM += s.widthM; });

  // Step 5: Handle 90° adjacent segments — hips or valleys
  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      const azDiff = Math.abs(parsed[i].azimuth - parsed[j].azimuth);
      const normalizedDiff = azDiff > 180 ? 360 - azDiff : azDiff;

      if (normalizedDiff >= 60 && normalizedDiff <= 120) {
        const edgeLen = Math.min(parsed[i].rafterLengthM, parsed[j].rafterLengthM);

        // Check if these segments are in the SAME section or DIFFERENT sections
        const iSections = roofSections.filter(s => s.indices.has(i));
        const jSections = roofSections.filter(s => s.indices.has(j));
        const sameSec = iSections.some(s => s.indices.has(j));

        if (!sameSec && iSections.length > 0 && jSections.length > 0) {
          // Different roof sections meeting → valley (where extensions meet main roof)
          totalValleyM += edgeLen;
        } else {
          // Same section, 90° apart → hip edge
          totalHipM += edgeLen;
        }
      }
    }
  }

  // Step 6: Unmatched segments (no ridge partner) → gable with rakes on both sides
  for (let i = 0; i < parsed.length; i++) {
    if (!pairedAsRidge.has(i)) {
      totalRakeM += parsed[i].rafterLengthM * 2;
    }
  }

  // Step 7: Simple 2-segment gable fallback
  if (totalRakeM === 0 && parsed.length <= 2) {
    parsed.forEach(s => {
      totalRakeM += s.rafterLengthM * 2;
    });
  }

  const ridge_ft = Math.round(totalRidgeM * M_TO_FT);
  const valley_ft = Math.round(totalValleyM * M_TO_FT);
  const eave_ft = Math.round(totalEaveM * M_TO_FT);
  const rake_ft = Math.round(totalRakeM * M_TO_FT);
  const hip_ft = Math.round(totalHipM * M_TO_FT);
  const drip_edge_ft = eave_ft + rake_ft;
  const flashing_ft = valley_ft + Math.round(totalRidgeM * 0.1 * M_TO_FT); // valleys + ~10% ridge for wall flashings

  return { ridge_ft, valley_ft, eave_ft, rake_ft, hip_ft, drip_edge_ft, flashing_ft };
}

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
    logger.error({ status: response.status, body: errorText, lat, lng }, 'Google Solar API error');
    if (response.status === 404) {
      throw new Error('Google Solar does not have roof data for this location. This is common for rural areas and newer construction. You can enter roof measurements manually instead.');
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

  // Derive edge lengths from segment geometry
  const edgeLengths = deriveEdgeLengths(segments, totalAreaM2);

  // Update property with roof measurement data
  await pool.query(
    `UPDATE properties
     SET roof_sqft = $1, roof_pitch_degrees = $2, roof_segments = $3, roof_measurement_source = 'google_solar',
         roof_ridge_ft = $5, roof_valley_ft = $6, roof_eave_ft = $7, roof_rake_ft = $8,
         roof_hip_ft = $9, roof_drip_edge_ft = $10, roof_flashing_ft = $11
     WHERE id = $4`,
    [roofSqft, avgPitch, roofSegments, propertyId,
     edgeLengths.ridge_ft, edgeLengths.valley_ft, edgeLengths.eave_ft, edgeLengths.rake_ft,
     edgeLengths.hip_ft, edgeLengths.drip_edge_ft, edgeLengths.flashing_ft]
  );

  // Insert usage record
  await pool.query(
    `INSERT INTO roof_measurement_usage (tenant_id, property_id, roof_sqft, roof_segments, avg_pitch_degrees, cost_cents, raw_response)
     VALUES ($1, $2, $3, $4, $5, 10, $6)`,
    [tenantId, propertyId, roofSqft, roofSegments, avgPitch, JSON.stringify(data)]
  );

  logger.info({ tenantId, propertyId, roofSqft, roofSegments, avgPitch, ...edgeLengths }, 'Roof measurement completed');

  return {
    roof_sqft: roofSqft, roof_pitch_degrees: avgPitch, roof_segments: roofSegments,
    ...edgeLengths,
    source: 'google_solar',
  };
}

/**
 * Manually set roof measurements for a property (no API call, no charge).
 */
export async function manualRoofEntry(propertyId, { roof_sqft, roof_pitch_degrees, roof_segments,
  roof_ridge_ft, roof_valley_ft, roof_eave_ft, roof_rake_ft, roof_hip_ft, roof_drip_edge_ft, roof_flashing_ft,
  source_type, additive }) {
  // In additive mode (drawing tool), add drawn values to existing Google Solar values
  // instead of overwriting them. This lets users supplement automated measurements.
  const isAdditive = additive && source_type === 'drawing';
  const src = isAdditive ? 'google_solar+manual_drawing' : (source_type === 'drawing' ? 'manual_drawing' : 'manual');
  const sets = [`roof_measurement_source = '${src}'`];
  const vals = [];
  let idx = 1;

  const addField = (col, val) => {
    if (val == null) return;
    if (isAdditive) {
      sets.push(`${col} = COALESCE(${col}, 0) + $${idx}`);
    } else {
      sets.push(`${col} = $${idx}`);
    }
    vals.push(val);
    idx++;
  };

  // For additive mode, don't overwrite sqft/pitch/segments — only add edge lengths
  if (!isAdditive) {
    addField('roof_sqft', roof_sqft);
    addField('roof_pitch_degrees', roof_pitch_degrees);
    addField('roof_segments', roof_segments);
  }
  addField('roof_ridge_ft', roof_ridge_ft);
  addField('roof_valley_ft', roof_valley_ft);
  addField('roof_eave_ft', roof_eave_ft);
  addField('roof_rake_ft', roof_rake_ft);
  addField('roof_hip_ft', roof_hip_ft);
  addField('roof_drip_edge_ft', roof_drip_edge_ft);
  addField('roof_flashing_ft', roof_flashing_ft);

  if (vals.length === 0) throw new Error('At least one measurement field is required');

  vals.push(propertyId);
  const { rows } = await pool.query(
    `UPDATE properties SET ${sets.join(', ')} WHERE id = $${idx}
     RETURNING roof_sqft, roof_pitch_degrees, roof_segments, roof_measurement_source,
               roof_ridge_ft, roof_valley_ft, roof_eave_ft, roof_rake_ft, roof_hip_ft, roof_drip_edge_ft, roof_flashing_ft`,
    vals
  );

  if (rows.length === 0) throw new Error('Property not found');
  logger.info({ propertyId, ...rows[0] }, 'Manual roof entry saved');
  return rows[0];
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
