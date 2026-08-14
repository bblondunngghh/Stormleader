import pool from './src/db/pool.js';
const t = await pool.query(`SELECT id FROM tenants WHERE slug='waterloo'`);
const tid = t.rows[0].id;
const r = await pool.query(`
  SELECT COUNT(*) total,
    COUNT(*) FILTER (WHERE assigned_to IS NULL) no_assignee,
    COUNT(*) FILTER (WHERE scheduled_time_start IS NULL) no_start,
    COUNT(*) FILTER (WHERE scheduled_date IS NULL) no_date,
    COUNT(*) FILTER (WHERE assigned_to IS NULL OR scheduled_time_start IS NULL
                        OR scheduled_time_end IS NULL OR scheduled_date IS NULL) would_400
  FROM work_orders WHERE tenant_id=$1`, [tid]);
console.log('BLAST RADIUS:', JSON.stringify(r.rows[0]));
const wo = await pool.query(`SELECT title, assigned_to, scheduled_date, scheduled_time_start, scheduled_time_end, lead_id, status FROM work_orders WHERE id='ae9acfaa-a3fd-4162-b749-36e733e1f9b6'`);
console.log('PROBED ROW AFTER SAVE:', JSON.stringify(wo.rows[0]));
await pool.end();
