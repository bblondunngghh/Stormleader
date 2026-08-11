import pool from './src/db/pool.js';
const r = await pool.query(`delete from tasks where title='R71S4 roundtrip probe' returning id`);
console.log('deleted probe tasks:', r.rowCount);
const c = await pool.query(`select count(*)::int n from tasks where tenant_id=(select id from tenants where slug='waterloo')`);
console.log('waterloo task count now:', c.rows[0].n);
await pool.end();
