import pool from '../db/pool.js';

// Backfill missing city/zip from nearest property that has them (within 5km)
// Uses a single bulk UPDATE with LATERAL join for efficiency

console.log('Starting city/zip backfill...');

const result = await pool.query(`
  UPDATE properties p
  SET city = COALESCE(NULLIF(TRIM(p.city), ''), nearest.city),
      zip  = COALESCE(NULLIF(TRIM(p.zip), ''), nearest.zip)
  FROM (
    SELECT DISTINCT ON (t.id) t.id AS target_id, n.city, n.zip
    FROM properties t
    CROSS JOIN LATERAL (
      SELECT city, zip
      FROM properties n2
      WHERE n2.id != t.id
        AND n2.city IS NOT NULL AND TRIM(n2.city) != ''
        AND n2.zip IS NOT NULL AND TRIM(n2.zip) != ''
        AND ST_DWithin(n2.location::geography, t.location::geography, 5000)
      ORDER BY n2.location::geography <-> t.location::geography
      LIMIT 1
    ) n
    WHERE t.city IS NULL OR TRIM(t.city) = '' OR t.zip IS NULL OR TRIM(t.zip) = ''
  ) nearest
  WHERE p.id = nearest.target_id
`);

console.log(`Done: ${result.rowCount} properties updated`);

// Also update leads table city from properties
const leadsResult = await pool.query(`
  UPDATE leads l
  SET city = p.city
  FROM properties p
  WHERE p.id = l.property_id
    AND p.city IS NOT NULL AND TRIM(p.city) != ''
    AND (l.city IS NULL OR TRIM(l.city) = '')
`);

console.log(`Leads updated: ${leadsResult.rowCount}`);

await pool.end();
