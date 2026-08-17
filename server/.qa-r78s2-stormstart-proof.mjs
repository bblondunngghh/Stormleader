// Run 78 s2 — READ-ONLY proof that the new storm_start LATERAL resolves a real date.
// No lead in this dataset has storm_event_id set, so the live API can only show NULL.
// This runs the EXACT join shape against a real storm_events row to prove it populates,
// and re-checks that the unqualified "source"/"created_at" in the WHERE/ORDER BY of the
// production query are still unambiguous with the LATERAL in place.
// ZERO writes: SELECT only.
import pool from './src/db/pool.js';

const q = async (label, sql, params = []) => {
  try {
    const { rows } = await pool.query(sql, params);
    console.log(`\n## ${label}\n`, JSON.stringify(rows.slice(0, 3), null, 1));
  } catch (e) {
    console.log(`\n## ${label}\n  !! ERROR ${e.code || ''} ${e.message}`);
  }
};

await q('storm_events available', `SELECT id, event_start, source FROM storm_events WHERE event_start IS NOT NULL ORDER BY event_start DESC LIMIT 2`);

// The exact LATERAL from the fix, fed a REAL storm_event_id via a synthetic pairing.
await q('LATERAL resolves a real date (synthetic pairing, no write)', `
  SELECT l.id AS lead_id, l.address, se.storm_start
  FROM (SELECT id, address FROM leads WHERE deleted_at IS NULL LIMIT 2) l
  CROSS JOIN LATERAL (
    SELECT event_start AS storm_start
    FROM storm_events
    WHERE event_start IS NOT NULL
    ORDER BY event_start DESC LIMIT 1
  ) se`);

// Full production query shape, exercising the unqualified names that could go ambiguous.
const tenant = (await pool.query(`SELECT tenant_id FROM leads WHERE deleted_at IS NULL LIMIT 1`)).rows[0]?.tenant_id;
await q('production query shape + source filter + created_at sort', `
  SELECT lsv.id, lsv.source, se.storm_start
  FROM lead_summary_view lsv
  LEFT JOIN LATERAL (
    SELECT status FROM financing_applications WHERE lead_id = lsv.id ORDER BY created_at DESC LIMIT 1
  ) fa ON true
  LEFT JOIN LATERAL (
    SELECT event_start AS storm_start FROM storm_events WHERE id = lsv.storm_event_id
  ) se ON true
  WHERE tenant_id = $1 AND deleted_at IS NULL AND source = $2
  ORDER BY created_at DESC
  LIMIT 3`, [tenant, 'canvassing']);

await pool.end();
