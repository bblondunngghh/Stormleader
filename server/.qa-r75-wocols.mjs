import pool from './src/db/pool.js';
const r = await pool.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='work_orders' AND column_name IN ('title','description','status','lead_id','assigned_to','crew_name','scheduled_date','scheduled_time_start','scheduled_time_end','line_items','notes') ORDER BY column_name`);
console.table(r.rows);
await pool.end();
