import pool from './src/db/pool.js';
const { rows } = await pool.query(
  `SELECT field_key, field_label, field_type, options, is_required, sort_order
   FROM custom_field_definitions
   WHERE tenant_id='791bb51d-3293-4839-92e9-bd4d4f873af2'
     AND (field_label LIKE 'k_' OR field_label LIKE 'QA r67%')
   ORDER BY created_at DESC`);
console.log('rows:', rows.length);
for (const r of rows) console.log(JSON.stringify(r));
await pool.end();
