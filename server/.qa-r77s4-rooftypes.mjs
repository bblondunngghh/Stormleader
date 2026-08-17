// Run 77 s4 — READ-ONLY: what roof_type values actually exist, vs the client price-map keys.
import pool from './src/db/pool.js';

const CLIENT_KEYS = ['composition', 'asphalt', 'metal', 'slate', 'tile', 'wood', 'built-up'];

const { rows } = await pool.query(
  `SELECT roof_type, COUNT(*)::int AS n
     FROM properties
    WHERE roof_type IS NOT NULL AND roof_type <> ''
    GROUP BY roof_type
    ORDER BY n DESC`
);

const unmatched = rows.filter(r => !CLIENT_KEYS.includes(String(r.roof_type).toLowerCase()));

console.log(JSON.stringify({
  distinctValues: rows,
  clientPriceMapKeys: CLIENT_KEYS,
  unmatchedByClientMap: unmatched,
  rowsPricedAtDefault: unmatched.reduce((a, r) => a + r.n, 0),
  rowsPricedCorrectly: rows.reduce((a, r) => a + r.n, 0) - unmatched.reduce((a, r) => a + r.n, 0),
}, null, 2));

await pool.end();
