import pool from '../db/pool.js';

// Backfill missing city/zip from nearest property that has them (within 5km)
// Processes in batches of 1000 with extended statement timeout

const BATCH = 1000;

// Disable statement timeout for this session
const client = await pool.connect();
await client.query('SET statement_timeout = 0');

const { rows: targets } = await client.query(`
  SELECT id, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
  FROM properties
  WHERE city IS NULL OR TRIM(city) = '' OR zip IS NULL OR TRIM(zip) = ''
`);

console.log(`Found ${targets.length} properties needing city/zip`);

let updated = 0;
for (let i = 0; i < targets.length; i += BATCH) {
  const batch = targets.slice(i, i + BATCH);
  const ids = batch.map(t => t.id);

  const result = await client.query(`
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
      WHERE t.id = ANY($1)
    ) nearest
    WHERE p.id = nearest.target_id
  `, [ids]);

  updated += result.rowCount;
  console.log(`Progress: ${Math.min(i + BATCH, targets.length)}/${targets.length} (${updated} updated)`);
}

// Also update leads table city from properties
const leadsResult = await client.query(`
  UPDATE leads l
  SET city = p.city
  FROM properties p
  WHERE p.id = l.property_id
    AND p.city IS NOT NULL AND TRIM(p.city) != ''
    AND (l.city IS NULL OR TRIM(l.city) = '')
`);

console.log(`Leads updated: ${leadsResult.rowCount}`);
console.log(`Done: ${updated} properties updated out of ${targets.length}`);

client.release();
await pool.end();
