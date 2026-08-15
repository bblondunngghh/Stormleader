import pool from './src/db/pool.js';
const { rows } = await pool.query(
  `SELECT table_name, column_name FROM information_schema.columns
   WHERE column_name LIKE '%_number' AND table_schema='public' ORDER BY table_name`
);
console.log(JSON.stringify(rows, null, 1));
await pool.end();
