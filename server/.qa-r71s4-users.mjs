import pool from './src/db/pool.js';
const r = await pool.query(`select first_name,last_name,email,role from users where tenant_id=(select id from tenants where slug='waterloo') order by role`);
console.table(r.rows);
await pool.end();
