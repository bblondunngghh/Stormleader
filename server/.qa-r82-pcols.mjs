import pool from './src/db/pool.js';
const r = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='payments' ORDER BY ordinal_position`);
console.log(r.rows.map(x=>x.column_name).join(', '));
await pool.end();
