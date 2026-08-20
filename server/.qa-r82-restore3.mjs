import pool from './src/db/pool.js';
const r=await pool.query(`UPDATE work_orders SET status='pending', completed_at=NULL WHERE id='383dbc15-fabe-4368-b4ab-f0eca93a4ca0' AND completed_at::date=CURRENT_DATE`);
console.log('work_order restored to pending:', r.rowCount);
await pool.end();
