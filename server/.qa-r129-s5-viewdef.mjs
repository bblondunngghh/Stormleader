import pool from './src/db/pool.js';
const r = await pool.query(`SELECT pg_get_viewdef('lead_summary_view'::regclass, true) AS def`);
console.log('=== LIVE VIEW DEFINITION ===');
console.log(r.rows[0].def);
const c = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='lead_summary_view' ORDER BY ordinal_position`);
console.log('=== COLUMNS (' + c.rows.length + ') ===');
console.log(c.rows.map(x=>x.column_name).join(', '));
await pool.end();
