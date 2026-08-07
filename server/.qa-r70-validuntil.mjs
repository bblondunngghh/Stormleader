import pool from './src/db/pool.js';
const r = await pool.query(`SELECT count(*) FILTER (WHERE valid_until IS NULL) AS null_vu, count(*) AS total FROM estimates`);
console.log(JSON.stringify(r.rows[0]));
await pool.end();
