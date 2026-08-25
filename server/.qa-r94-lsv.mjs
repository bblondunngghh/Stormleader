import pool from './src/db/pool.js';
const c=(await pool.query(`SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='lead_summary_view' AND column_name IN ('id','stage','assigned_rep_id','tenant_id','deleted_at')`)).rows;
console.log(JSON.stringify(c));
await pool.end();
