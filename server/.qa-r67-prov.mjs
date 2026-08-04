import pool from './src/db/pool.js';
const A='791bb51d-3293-4839-92e9-bd4d4f873af2';
const r = await pool.query(
  `SELECT id, estimate_number, customer_name, status, total, created_at, updated_at, line_items
     FROM estimates WHERE id = ANY($1)`,
  [['1252940b-b691-4182-8d4f-680ac71a0711','2dd4659c-ed16-4353-9ee6-5dfdf944f365']]);
r.rows.forEach(x=>console.log(JSON.stringify(x)));
console.log('\n--- newest 6 estimates for context (is [null] the newest = QA artifact?) ---');
const n = await pool.query(`SELECT estimate_number, customer_name, created_at FROM estimates WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 6`,[A]);
n.rows.forEach(x=>console.log(' ', x.estimate_number, '|', x.customer_name, '|', x.created_at.toISOString()));
await pool.end();
