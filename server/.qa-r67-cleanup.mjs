import pool from './src/db/pool.js';
const { rowCount } = await pool.query(
  `DELETE FROM custom_field_definitions
   WHERE tenant_id='791bb51d-3293-4839-92e9-bd4d4f873af2'
     AND (field_label ~ '^k[0-9]$' OR field_label LIKE 'QA r67%' OR field_label='ok')`);
console.log('deleted rows:', rowCount);
const { rows } = await pool.query(
  `SELECT count(*)::int AS remaining FROM custom_field_definitions
   WHERE tenant_id='791bb51d-3293-4839-92e9-bd4d4f873af2'`);
console.log('remaining custom fields for tenant:', rows[0].remaining);
await pool.end();
