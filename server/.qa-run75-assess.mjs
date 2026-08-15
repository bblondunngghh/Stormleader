// Run 75 s1 — assess (and restore) the 5 rows the coercion probe nulled.
import pool from './src/db/pool.js';

const q = async (label, sql, params = []) => {
  const { rows } = await pool.query(sql, params);
  console.log(`\n== ${label} ==`);
  console.log(JSON.stringify(rows, null, 1).slice(0, 1800));
  return rows;
};

await q('work_order a85b7ae6 (lead_id, scheduled_date nulled)',
  `SELECT id, title, lead_id, estimate_id, scheduled_date, status, created_at, updated_at
   FROM work_orders WHERE id='a85b7ae6-3004-49fb-9f20-62f38fed3d39'`);

await q('estimate 79c7324a (valid_until nulled)',
  `SELECT id, estimate_number, lead_id, valid_until, status, created_at, updated_at
   FROM estimates WHERE id='79c7324a-ec2e-45f3-91a2-d3c5f6f36fd9'`);

await q('lead 088823f1 (assigned_to, appointment_date nulled)',
  `SELECT id, contact_name, address, stage, assigned_to, appointment_date, created_at, updated_at
   FROM leads WHERE id='088823f1-d1e0-4cad-8e21-2208cf47c52b'`);

// How common is each value across siblings? Tells us whether the pre-probe value
// was plausibly already NULL (no damage) or almost certainly populated (damage).
await q('work_orders: how many have lead_id / scheduled_date set?',
  `SELECT count(*) AS total,
          count(lead_id) AS with_lead,
          count(scheduled_date) AS with_sched
   FROM work_orders WHERE tenant_id='791bb51d-3293-4839-92e9-bd4d4f873af2'`);

await q('estimates: how many have valid_until set?',
  `SELECT count(*) AS total, count(valid_until) AS with_valid_until
   FROM estimates WHERE tenant_id='791bb51d-3293-4839-92e9-bd4d4f873af2'`);

await q('leads: how many have assigned_to / appointment_date set?',
  `SELECT count(*) AS total, count(assigned_to) AS with_assigned, count(appointment_date) AS with_appt
   FROM leads WHERE tenant_id='791bb51d-3293-4839-92e9-bd4d4f873af2'`);

await pool.end();
