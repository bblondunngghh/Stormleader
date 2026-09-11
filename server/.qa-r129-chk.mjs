import pool from './src/db/pool.js';
const { rows } = await pool.query(`SELECT id, estimate_number, customer_name, status, total, created_at FROM estimates ORDER BY created_at DESC LIMIT 8`);
console.log(JSON.stringify(rows, null, 1));
const { rows: c } = await pool.query('SELECT count(*) n FROM estimates');
console.log('total estimates:', c[0].n);
await pool.end();
