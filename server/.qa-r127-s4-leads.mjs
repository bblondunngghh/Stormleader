import pool from './src/db/pool.js';
const { rows } = await pool.query(
  `SELECT tenant_id, count(*)::int n, min(id::text) sample_id, min(contact_name) sample_name
   FROM leads GROUP BY tenant_id ORDER BY n DESC`);
console.log(JSON.stringify(rows, null, 1));
const e = await pool.query(`SELECT tenant_id, count(*)::int n, min(id::text) sample FROM estimates GROUP BY tenant_id`);
console.log('ESTIMATES:', JSON.stringify(e.rows));
const u = await pool.query(`SELECT tenant_id, count(*)::int n, min(id::text) sample FROM users GROUP BY tenant_id`);
console.log('USERS:', JSON.stringify(u.rows));
await pool.end();
