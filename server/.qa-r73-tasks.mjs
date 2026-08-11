import pool from './src/db/pool.js';
const T = '791bb51d-3293-4839-92e9-bd4d4f873af2';
const { rows } = await pool.query(
  `SELECT id, title, status, completed_at IS NOT NULL AS has_completed_at,
          to_char(due_date,'YYYY-MM-DD HH24:MI') AS due, priority::text, assigned_to IS NULL AS unassigned
   FROM tasks WHERE tenant_id=$1 ORDER BY created_at DESC`, [T]);
console.log('total tasks:', rows.length);
console.table(rows.map(r => ({ title: (r.title||'').slice(0,28), status: r.status, completed_at: r.has_completed_at, due: r.due, prio: r.priority })));
const { rows: byStatus } = await pool.query(
  `SELECT status, count(*) FROM tasks WHERE tenant_id=$1 GROUP BY status ORDER BY 2 DESC`, [T]);
console.log('by status:', JSON.stringify(byStatus));
await pool.end();
