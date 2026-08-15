import pool from './src/db/pool.js';
const q = async (label, sql, params = []) => {
  const { rows } = await pool.query(sql, params);
  console.log(`\n== ${label} ==`);
  console.log(JSON.stringify(rows, null, 1).slice(0, 2500));
  return rows;
};

await q('leads columns matching assign/appoint/value',
  `SELECT column_name, data_type, is_nullable FROM information_schema.columns
   WHERE table_name='leads' AND (column_name ILIKE '%assign%' OR column_name ILIKE '%appoint%' OR column_name ILIKE '%value%')
   ORDER BY column_name`);

await q('lead 088823f1 current',
  `SELECT id, contact_name, stage, appointment_date, estimated_value, updated_at
   FROM leads WHERE id='088823f1-d1e0-4cad-8e21-2208cf47c52b'`);

await q('estimates valid_until pattern (how it relates to created_at)',
  `SELECT estimate_number, created_at::date AS created, valid_until,
          (valid_until - created_at::date) AS days_offset
   FROM estimates WHERE tenant_id='791bb51d-3293-4839-92e9-bd4d4f873af2'
   ORDER BY estimate_number LIMIT 25`);

await q('estimates: null valid_until count',
  `SELECT count(*) AS total, count(valid_until) AS with_vu
   FROM estimates WHERE tenant_id='791bb51d-3293-4839-92e9-bd4d4f873af2'`);

await q('leads appointment_date populated count',
  `SELECT count(*) AS total, count(appointment_date) AS with_appt
   FROM leads WHERE tenant_id='791bb51d-3293-4839-92e9-bd4d4f873af2'`);

await pool.end();
