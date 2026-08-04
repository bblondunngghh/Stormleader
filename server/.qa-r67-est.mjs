import pool from './src/db/pool.js';
const A='791bb51d-3293-4839-92e9-bd4d4f873af2';
const bad = await pool.query(
  `SELECT id, estimate_number, jsonb_array_length(line_items) AS n, line_items
     FROM estimates
    WHERE tenant_id=$1
      AND jsonb_typeof(line_items)='array'
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(line_items) el WHERE jsonb_typeof(el)='null')
    ORDER BY created_at DESC`,[A]);
const tot = await pool.query(`SELECT count(*)::int n FROM estimates WHERE tenant_id=$1`,[A]);
console.log(`estimates whose line_items contain a NULL element: ${bad.rowCount} of ${tot.rows[0].n}`);
bad.rows.forEach(r=>console.log(`  ${r.id}  #${r.estimate_number}  len=${r.n}  ${JSON.stringify(r.line_items).slice(0,120)}`));
// also: non-array line_items (object/string/null) would break Array.isArray -> [] (safe) 
const shapes = await pool.query(
  `SELECT jsonb_typeof(line_items) AS t, count(*)::int n FROM estimates WHERE tenant_id=$1 GROUP BY 1 ORDER BY n DESC`,[A]);
console.log('\nline_items JSON shapes across tenant:', shapes.rows.map(r=>`${r.t}=${r.n}`).join('  '));
await pool.end();
