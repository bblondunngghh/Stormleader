import pool from './src/db/pool.js';
const r = await pool.query(`DELETE FROM contracts WHERE id IN ('9b61280e-9c99-4d9a-a2f2-67a2ae2fc426','0de6dca1-d23f-4d5a-99b0-5391aaac0195') RETURNING id`);
console.log('deleted probe contracts:', r.rowCount);
const c = await pool.query(`SELECT count(*)::int n FROM contracts WHERE tenant_id='791bb51d-3293-4839-92e9-bd4d4f873af2'`);
console.log('contracts now:', c.rows[0].n);
await pool.end();
