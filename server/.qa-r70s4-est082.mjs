import pool from './src/db/pool.js';
const r = await pool.query(`SELECT id, estimate_number, line_items, customer_name, updated_at FROM estimates WHERE estimate_number='EST-082' AND line_items::text LIKE '%null%'`);
console.log(JSON.stringify(r.rows, null, 1));
await pool.end();
