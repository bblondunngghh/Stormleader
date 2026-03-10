import pool from '../db/pool.js';

// Add sine wave offset to a LineString to make it wavy
function makeWavy(geometry, azimuthDeg) {
  const amp = 0.004;    // wave amplitude in degrees (~0.4km)
  const freq = 80;      // wave frequency (higher = more waves)
  const azRad = (azimuthDeg * Math.PI) / 180;
  // Perpendicular direction (offset axis)
  const perpX = -Math.cos(azRad); // sin(az - 90)
  const perpY = Math.sin(azRad);  // cos(az - 90)

  function wavifyCoords(coords) {
    if (coords.length < 2) return coords;
    // Resample to more points for smooth wave
    const resampled = [];
    for (let j = 0; j < coords.length - 1; j++) {
      const [x0, y0] = coords[j];
      const [x1, y1] = coords[j + 1];
      const segLen = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2);
      const steps = Math.max(1, Math.round(segLen / 0.002));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        resampled.push([x0 + t * (x1 - x0), y0 + t * (y1 - y0)]);
      }
    }
    resampled.push(coords[coords.length - 1]);
    // Apply sine wave
    let cumDist = 0;
    const result = [resampled[0]];
    for (let j = 1; j < resampled.length; j++) {
      const dx = resampled[j][0] - resampled[j - 1][0];
      const dy = resampled[j][1] - resampled[j - 1][1];
      cumDist += Math.sqrt(dx * dx + dy * dy);
      const offset = amp * Math.sin(cumDist * freq);
      result.push([
        resampled[j][0] + offset * perpX,
        resampled[j][1] + offset * perpY,
      ]);
    }
    return result;
  }

  if (geometry.type === 'LineString') {
    return { type: 'LineString', coordinates: wavifyCoords(geometry.coordinates) };
  }
  if (geometry.type === 'MultiLineString') {
    return {
      type: 'MultiLineString',
      coordinates: geometry.coordinates.map(c => wavifyCoords(c)),
    };
  }
  return geometry;
}

export async function listEvents({ source, limit = 50, offset = 0, timeRange }) {
  const params = [];
  const conditions = [];

  if (source) {
    params.push(source);
    conditions.push(`source = $${params.length}`);
  }

  if (timeRange) {
    const intervals = { '24h': '24 hours', '7d': '7 days', '30d': '30 days' };
    const interval = intervals[timeRange];
    if (interval) {
      conditions.push(`event_start >= NOW() - INTERVAL '${interval}'`);
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(limit, offset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;

  const { rows } = await pool.query(
    `SELECT id, source, source_id,
            ST_AsGeoJSON(ST_ChaikinSmoothing(ST_Simplify(geom, 0.0001), 3))::json AS geometry,
            hail_size_max_in, wind_speed_max_mph,
            event_start, event_end, raw_data, created_at
     FROM storm_events
     ${where}
     ORDER BY event_start DESC NULLS LAST
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );

  return {
    type: 'FeatureCollection',
    features: rows.map((r) => ({
      type: 'Feature',
      id: r.id,
      geometry: r.geometry,
      properties: {
        source: r.source,
        source_id: r.source_id,
        hail_size_max_in: r.hail_size_max_in,
        wind_speed_max_mph: r.wind_speed_max_mph,
        event_start: r.event_start,
        event_end: r.event_end,
        raw_data: r.raw_data,
      },
    })),
  };
}

export async function getEvent(id) {
  const { rows } = await pool.query(
    `SELECT id, source, source_id,
            ST_AsGeoJSON(ST_Simplify(geom, 0.0001))::json AS geometry,
            ST_AsGeoJSON(bbox)::json AS bbox_geometry,
            hail_size_max_in, wind_speed_max_mph,
            event_start, event_end, raw_data, created_at
     FROM storm_events
     WHERE id = $1`,
    [id]
  );

  if (rows.length === 0) return null;

  const r = rows[0];
  return {
    type: 'Feature',
    id: r.id,
    geometry: r.geometry,
    properties: {
      source: r.source,
      source_id: r.source_id,
      bbox_geometry: r.bbox_geometry,
      hail_size_max_in: r.hail_size_max_in,
      wind_speed_max_mph: r.wind_speed_max_mph,
      event_start: r.event_start,
      event_end: r.event_end,
      raw_data: r.raw_data,
    },
  };
}

// Texas bounding box
const TX_BOUNDS = { west: -106.65, south: 25.84, east: -93.51, north: 36.50 };

// Simplified Texas boundary polygon for filtering out Oklahoma/neighboring state storms.
// Uses ~20 key vertices: panhandle top, east along Red River, down Sabine, Gulf coast, Rio Grande.
const TX_POLYGON = `ST_GeomFromText('POLYGON((
  -103.05 36.50, -100.00 36.50, -100.00 34.56,
  -99.70 34.40, -99.20 34.10, -98.80 34.00, -98.00 33.90,
  -97.20 33.85, -96.50 33.82, -95.80 33.88, -95.00 33.86,
  -94.50 33.64, -94.00 33.55, -93.85 33.00,
  -93.70 32.00, -93.70 31.00, -93.80 30.10,
  -93.90 29.80, -94.70 29.55, -95.60 29.30,
  -96.40 28.60, -97.00 27.80, -97.15 26.00,
  -97.50 25.84, -99.00 26.40, -99.70 27.50,
  -100.30 28.60, -101.00 29.40, -102.30 29.80,
  -103.30 29.00, -104.50 29.60, -106.00 31.00,
  -106.60 31.80, -106.60 32.00, -103.05 32.00,
  -103.05 36.50
))', 4326)`;

export async function getSwathsByViewport(bbox, timeRange, startDate, endDate) {
  // Clamp viewport to Texas bounds
  const [west, south, east, north] = [
    Math.max(bbox[0], TX_BOUNDS.west),
    Math.max(bbox[1], TX_BOUNDS.south),
    Math.min(bbox[2], TX_BOUNDS.east),
    Math.min(bbox[3], TX_BOUNDS.north),
  ];
  // If viewport doesn't overlap Texas at all, return empty
  if (west >= east || south >= north) {
    return { type: 'FeatureCollection', features: [] };
  }
  const params = [west, south, east, north];

  let timeFilter = '';
  if (timeRange && timeRange !== 'custom') {
    const intervals = { '24h': '24 hours', '7d': '7 days', '30d': '30 days' };
    const interval = intervals[timeRange];
    if (interval) {
      timeFilter = `AND event_start >= NOW() - INTERVAL '${interval}'`;
    }
  } else if (startDate && endDate) {
    params.push(startDate, endDate);
    timeFilter = `AND event_start >= $${params.length - 1} AND event_start <= $${params.length}`;
  }

  // Fetch individual features (for popup data on click)
  const { rows } = await pool.query(
    `SELECT id, source, source_id,
            ST_AsGeoJSON(ST_ChaikinSmoothing(ST_Simplify(geom, 0.0001), 3))::json AS geometry,
            ST_AsGeoJSON(ST_ChaikinSmoothing(ST_Simplify(drift_corrected_geom, 0.0001), 3))::json AS drift_geometry,
            drift_vector_m,
            hail_size_max_in, wind_speed_max_mph,
            event_start, event_end, raw_data
     FROM storm_events
     WHERE ST_Intersects(geom, ST_MakeEnvelope($1, $2, $3, $4, 4326))
     AND ST_Intersects(geom, ${TX_POLYGON})
     ${timeFilter}
     ORDER BY event_start DESC NULLS LAST`,
    params
  );

  // Fetch merged outlines — wind/tornado as single groups, hail grouped by size threshold for gradient
  let mergedFeatures = [];
  try {
    // Wind/tornado merged outlines
    const { rows: wtMerged } = await pool.query(
      `SELECT event_type,
              ST_AsGeoJSON(ST_ChaikinSmoothing(ST_Simplify(ST_Union(ST_Buffer(ST_MakeValid(geom), 0)), 0.0002), 5))::json AS geometry
       FROM (
         SELECT geom,
           CASE
             WHEN raw_data->>'type' = 'tornado' THEN 'tornado'
             ELSE 'wind'
           END AS event_type
         FROM storm_events
         WHERE ST_Intersects(geom, ST_MakeEnvelope($1, $2, $3, $4, 4326))
         AND ST_Intersects(geom, ${TX_POLYGON})
         AND ST_GeometryType(geom) != 'ST_Point'
         AND (raw_data->>'type' IN ('wind', 'tornado') OR (wind_speed_max_mph IS NOT NULL AND hail_size_max_in IS NULL))
         ${timeFilter}
       ) typed
       GROUP BY event_type`,
      params
    );
    for (const m of wtMerged) {
      if (!m.geometry) continue;
      mergedFeatures.push({
        type: 'Feature',
        id: `merged_${m.event_type}`,
        geometry: m.geometry,
        properties: { _merged: true, _mergedType: m.event_type },
      });
    }

    // Hail merged outlines — grouped by size threshold for gradient effect
    const { rows: hailMerged } = await pool.query(
      `SELECT hail_size_max_in,
              ST_AsGeoJSON(ST_ChaikinSmoothing(ST_Simplify(ST_Union(ST_Buffer(ST_MakeValid(geom), 0)), 0.0002), 5))::json AS geometry,
              ST_AsGeoJSON(ST_ChaikinSmoothing(ST_Simplify(ST_Union(ST_Buffer(ST_MakeValid(
                CASE WHEN drift_corrected_geom IS NOT NULL AND ST_IsValid(drift_corrected_geom) THEN drift_corrected_geom ELSE geom END
              ), 0)), 0.0002), 5))::json AS drift_geometry
       FROM storm_events
       WHERE ST_Intersects(geom, ST_MakeEnvelope($1, $2, $3, $4, 4326))
       AND ST_Intersects(geom, ${TX_POLYGON})
       AND ST_GeometryType(geom) != 'ST_Point'
       AND hail_size_max_in IS NOT NULL AND hail_size_max_in > 0
       ${timeFilter}
       GROUP BY hail_size_max_in
       ORDER BY hail_size_max_in ASC`,
      params
    );
    for (const m of hailMerged) {
      if (!m.geometry) continue;
      mergedFeatures.push({
        type: 'Feature',
        id: `merged_hail_${m.hail_size_max_in}`,
        geometry: m.geometry,
        properties: {
          _merged: true,
          _mergedType: 'hail',
          hail_size_max_in: m.hail_size_max_in,
          drift_geometry: m.drift_geometry,
        },
      });
    }
    // Wind flow lines — parallel lines within each wind polygon oriented along wind direction
    const { rows: flowLines } = await pool.query(
      `WITH wind_polys AS (
         SELECT geom,
                ST_Azimuth(
                  ST_StartPoint(ST_LongestLine(geom, geom)),
                  ST_EndPoint(ST_LongestLine(geom, geom))
                ) AS az_rad,
                ST_Centroid(geom) AS ctr,
                ST_Length(ST_LongestLine(geom, geom)) AS diag
         FROM storm_events
         WHERE ST_Intersects(geom, ST_MakeEnvelope($1, $2, $3, $4, 4326))
         AND ST_Intersects(geom, ${TX_POLYGON})
         AND ST_GeometryType(geom) = 'ST_Polygon'
         AND (raw_data->>'type' = 'wind' OR (wind_speed_max_mph IS NOT NULL AND hail_size_max_in IS NULL))
         ${timeFilter}
       ),
       flow AS (
         SELECT
           ST_Intersection(
             wp.geom,
             ST_Rotate(
               ST_SetSRID(ST_MakeLine(
                 ST_MakePoint(ST_X(wp.ctr) + i * 0.045, ST_Y(wp.ctr) - wp.diag),
                 ST_MakePoint(ST_X(wp.ctr) + i * 0.045, ST_Y(wp.ctr) + wp.diag)
               ), 4326),
               -wp.az_rad,
               wp.ctr
             )
           ) AS line_geom,
           degrees(wp.az_rad) AS azimuth
         FROM wind_polys wp
         CROSS JOIN generate_series(-12, 12) AS i
       )
       SELECT ST_AsGeoJSON(line_geom)::json AS geometry, azimuth
       FROM flow
       WHERE NOT ST_IsEmpty(line_geom)
         AND ST_GeometryType(line_geom) IN ('ST_LineString', 'ST_MultiLineString')`,
      params
    );
    let arrowIdx = 0;
    for (let i = 0; i < flowLines.length; i++) {
      const fl = flowLines[i];
      if (!fl.geometry) continue;
      // Make flow lines wavy with sine wave offset perpendicular to line direction
      const wavyGeom = makeWavy(fl.geometry, fl.azimuth);
      mergedFeatures.push({
        type: 'Feature',
        id: `wind_flow_${i}`,
        geometry: wavyGeom,
        properties: { _windFlow: true },
      });
      // Place arrowheads at regular intervals along the line
      const allCoords = fl.geometry.type === 'LineString'
        ? [fl.geometry.coordinates]
        : fl.geometry.coordinates || [];
      for (const coords of allCoords) {
        if (!coords || coords.length < 2) continue;
        // Compute total line length in degrees, place arrow every ~0.04 deg (~4km)
        let totalLen = 0;
        for (let j = 1; j < coords.length; j++) {
          const dx = coords[j][0] - coords[j - 1][0];
          const dy = coords[j][1] - coords[j - 1][1];
          totalLen += Math.sqrt(dx * dx + dy * dy);
        }
        const spacing = 0.12;
        const numArrows = Math.max(1, Math.floor(totalLen / spacing));
        for (let a = 0; a < numArrows; a++) {
          const frac = (a + 0.5) / numArrows;
          const targetDist = frac * totalLen;
          let cumDist = 0;
          for (let j = 1; j < coords.length; j++) {
            const dx = coords[j][0] - coords[j - 1][0];
            const dy = coords[j][1] - coords[j - 1][1];
            const segLen = Math.sqrt(dx * dx + dy * dy);
            if (cumDist + segLen >= targetDist) {
              const t = (targetDist - cumDist) / segLen;
              const pt = [
                coords[j - 1][0] + t * dx,
                coords[j - 1][1] + t * dy,
              ];
              mergedFeatures.push({
                type: 'Feature',
                id: `wind_arrow_${arrowIdx++}`,
                geometry: { type: 'Point', coordinates: pt },
                properties: { _windArrow: true, azimuth: fl.azimuth },
              });
              break;
            }
            cumDist += segLen;
          }
        }
      }
    }
  } catch (mergeErr) {
    console.error('Merged outline query failed, falling back to individual features:', mergeErr.message);
  }

  return {
    type: 'FeatureCollection',
    features: [
      ...mergedFeatures,
      ...rows.map((r) => ({
        type: 'Feature',
        id: r.id,
        geometry: r.geometry,
        properties: {
          source: r.source,
          source_id: r.source_id,
          hail_size_max_in: r.hail_size_max_in,
          wind_speed_max_mph: r.wind_speed_max_mph,
          event_start: r.event_start,
          event_end: r.event_end,
          raw_data: r.raw_data,
          drift_geometry: r.drift_geometry,
          drift_vector_m: r.drift_vector_m,
        },
      })),
    ],
  };
}
