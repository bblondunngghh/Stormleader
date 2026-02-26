import pool from '../db/pool.js';

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
            ST_AsGeoJSON(geom)::json AS geometry,
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
            ST_AsGeoJSON(geom)::json AS geometry,
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

export async function getSwathsByViewport(bbox, timeRange, startDate, endDate) {
  const [west, south, east, north] = bbox;
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

  const { rows } = await pool.query(
    `SELECT id, source, source_id,
            ST_AsGeoJSON(geom)::json AS geometry,
            ST_AsGeoJSON(drift_corrected_geom)::json AS drift_geometry,
            drift_vector_m,
            hail_size_max_in, wind_speed_max_mph,
            event_start, event_end, raw_data
     FROM storm_events
     WHERE ST_Intersects(geom, ST_MakeEnvelope($1, $2, $3, $4, 4326))
     ${timeFilter}
     ORDER BY event_start DESC NULLS LAST`,
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
        drift_geometry: r.drift_geometry,
        drift_vector_m: r.drift_vector_m,
      },
    })),
  };
}
