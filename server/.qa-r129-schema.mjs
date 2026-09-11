import pool from './src/db/pool.js';
const { rows } = await pool.query(`SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name='estimates' AND column_name IN ('lead_id','customer_name','tenant_id') ORDER BY column_name`);
console.log(JSON.stringify(rows));
const { rows: r2 } = await pool.query(`SELECT count(*) FILTER (WHERE lead_id IS NULL) AS null_lead, count(*) AS total FROM estimates`);
console.log(JSON.stringify(r2));
await pool.end();
