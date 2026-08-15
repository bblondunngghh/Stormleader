import pool from './src/db/pool.js';
const q = async (label, sql) => {
  const { rows } = await pool.query(sql);
  console.log(`\n== ${label} ==`);
  console.log(JSON.stringify(rows, null, 1).slice(0, 3000));
  return rows;
};

await q('estimates valid_until vs created_at',
  `SELECT estimate_number, created_at::date AS created, valid_until,
          (valid_until - created_at::date) AS days_offset
   FROM estimates WHERE tenant_id='791bb51d-3293-4839-92e9-bd4d4f873af2'
   ORDER BY estimate_number`);

await q('estimates valid_until null count',
  `SELECT count(*) AS total, count(valid_until) AS with_vu
   FROM estimates WHERE tenant_id='791bb51d-3293-4839-92e9-bd4d4f873af2'`);

await pool.end();
