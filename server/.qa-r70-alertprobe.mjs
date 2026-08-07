import pool from './src/db/pool.js';
const { rows } = await pool.query(`
  SELECT column_name, data_type, udt_name
  FROM information_schema.columns
  WHERE table_name='alert_configs' ORDER BY ordinal_position`);
console.log('--- alert_configs schema ---');
rows.forEach(r=>console.log(' ', r.column_name, '|', r.data_type, '|', r.udt_name));
const { rows: cur } = await pool.query(
  `SELECT * FROM alert_configs WHERE tenant_id='791bb51d-3293-4839-92e9-bd4d4f873af2'`);
console.log('--- CURRENT ROW (save for restore) ---');
console.log(JSON.stringify(cur[0], null, 1));
await pool.end();
