import pool from './src/db/pool.js';
const r = await pool.query(`SELECT trigger_name, event_manipulation, action_statement FROM information_schema.triggers WHERE event_object_table='leads'`);
console.table(r.rows);
await pool.end();
