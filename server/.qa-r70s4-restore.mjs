import pool from './src/db/pool.js';
const id = '2dd4659c-ed16-4353-9ee6-5dfdf944f365';
await pool.query(`UPDATE estimates SET line_items = $2::jsonb, customer_name = NULL, updated_at = '2026-06-07T10:25:03.507Z' WHERE id = $1`,
  [id, JSON.stringify([null, "", 1])]);
const r = await pool.query(`SELECT estimate_number, line_items, customer_name, updated_at FROM estimates WHERE id=$1`, [id]);
console.log(JSON.stringify(r.rows[0]));
await pool.end();
