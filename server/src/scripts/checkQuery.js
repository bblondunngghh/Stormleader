import pool from '../db/pool.js';

// Test the optimized query (reversed join order + bbox pre-filter)
const start = Date.now();
const { rows } = await pool.query(`
  SELECT COUNT(*) as cnt FROM (
    SELECT DISTINCT ON (p.id) p.id
    FROM storm_events se
    JOIN properties p ON p.location && se.geom AND ST_Intersects(p.location, se.geom)
    WHERE se.geom && ST_MakeEnvelope(-99.1, 29.0, -97.97, 30.0, 4326)
      AND se.event_start >= NOW() - INTERVAL '30 days'
    ORDER BY p.id, se.hail_size_max_in DESC NULLS LAST
    LIMIT 5000
  ) sub
`);
console.log('Optimized (reversed join + bbox):', rows[0].cnt, 'results in', Date.now() - start, 'ms');

// Also test Cuero specifically
const start2 = Date.now();
const { rows: r2 } = await pool.query(`
  SELECT COUNT(*) as cnt FROM (
    SELECT DISTINCT ON (p.id) p.id
    FROM storm_events se
    JOIN properties p ON p.location && se.geom AND ST_Intersects(p.location, se.geom)
    WHERE se.geom && ST_MakeEnvelope(-97.5, 28.8, -96.8, 29.3, 4326)
      AND se.event_start >= NOW() - INTERVAL '30 days'
    ORDER BY p.id, se.hail_size_max_in DESC NULLS LAST
    LIMIT 5000
  ) sub
`);
console.log('Cuero area:', r2[0].cnt, 'results in', Date.now() - start2, 'ms');

await pool.end();
