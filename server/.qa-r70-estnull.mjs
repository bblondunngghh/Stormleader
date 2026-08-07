// R70 s2b — ground truth: do any estimates hold a NULL element inside line_items?
// Read-only. Proves whether EstimatesView.jsx:1491 is reachable with real stored data.
import pool from './src/db/pool.js';

const q = await pool.query(`
  SELECT id, estimate_number, status, created_at,
         jsonb_array_length(line_items) AS n,
         (SELECT count(*) FROM jsonb_array_elements(line_items) e
           WHERE jsonb_typeof(e) = 'null') AS null_elems,
         (SELECT count(*) FROM jsonb_array_elements(line_items) e
           WHERE jsonb_typeof(e) <> 'object') AS nonobj_elems
  FROM estimates
  WHERE line_items IS NOT NULL AND jsonb_typeof(line_items) = 'array'
  ORDER BY created_at DESC NULLS LAST`);

const bad = q.rows.filter(r => Number(r.null_elems) > 0 || Number(r.nonobj_elems) > 0);
console.log(JSON.stringify({
  total_with_array_line_items: q.rows.length,
  bad_count: bad.length,
  bad,
  newest_5: q.rows.slice(0, 5).map(r => ({ n: r.estimate_number, items: r.n, nulls: r.null_elems })),
}, null, 1));

// also: is line_items ever a non-array entirely?
const nonArr = await pool.query(`
  SELECT id, estimate_number, jsonb_typeof(line_items) AS t
  FROM estimates
  WHERE line_items IS NOT NULL AND jsonb_typeof(line_items) <> 'array'`);
console.log('NON_ARRAY_line_items:', JSON.stringify(nonArr.rows));

await pool.end();
