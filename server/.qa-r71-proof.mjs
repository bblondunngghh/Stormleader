import pool from './src/db/pool.js';
// Reproduce the PRE-FIX loop exactly as it stood at materials.js:673-678
const { rows } = await pool.query(`SELECT estimate_number, line_items FROM estimates
  WHERE id IN ('1252940b-b691-4182-8d4f-680ac71a0711','2dd4659c-ed16-4353-9ee6-5dfdf944f365')`);
for (const est of rows) {
  const lineItems = est.line_items || [];            // <- the old guard
  try {
    for (const li of lineItems) { const desc = (li.description || '').toLowerCase(); void desc; }
    console.log(`${est.estimate_number} line_items=${JSON.stringify(est.line_items)} -> OLD CODE OK`);
  } catch (e) {
    console.log(`${est.estimate_number} line_items=${JSON.stringify(est.line_items)} -> OLD CODE THROWS: ${e.constructor.name}: ${e.message}`);
  }
}
// clean up probe-created material_orders (srs_order_id prefix SRS- created in the last 30 min)
const del = await pool.query(
  `DELETE FROM material_orders WHERE created_at > now() - interval '30 minutes' RETURNING srs_order_id, items`);
console.log(`\ndeleted ${del.rowCount} probe material_orders:`, del.rows.map(r=>r.srs_order_id).join(', '));
const left = await pool.query('SELECT count(*)::int c FROM material_orders');
console.log('material_orders remaining:', left.rows[0].c, '(was 3 at run start)');
await pool.end();
