import pool from './src/db/pool.js';
const A='791bb51d-3293-4839-92e9-bd4d4f873af2';
const d = await pool.query(
  `SELECT jsonb_array_length(line_items) n, count(*)::int c
     FROM estimates WHERE tenant_id=$1 AND jsonb_typeof(line_items)='array' GROUP BY 1 ORDER BY 1`,[A]);
console.log('line_items length distribution:', d.rows.map(r=>`len${r.n}=${r.c}`).join('  '));
const { rows } = await pool.query(
  `SELECT id, estimate_number, subtotal, total, line_items
     FROM estimates WHERE tenant_id=$1
       AND EXISTS (SELECT 1 FROM jsonb_array_elements(line_items) el WHERE jsonb_typeof(el)='object')
     ORDER BY jsonb_array_length(line_items) DESC LIMIT 3`,[A]);
rows.forEach(r=>{
  console.log(`\n${r.estimate_number} ${r.id} subtotal=${r.subtotal} total=${r.total}`);
  console.log('  items:', JSON.stringify(r.line_items).slice(0,300));
});
