import pool from './src/db/pool.js';
const T = (await pool.query(`SELECT id FROM tenants WHERE slug='waterloo'`)).rows[0].id;
for (const [label, sql] of [
  ['tasks', `SELECT count(*)::int c, count(due_date)::int withdue FROM tasks WHERE tenant_id=$1`],
  ['appointments', `SELECT count(*)::int c FROM appointments WHERE tenant_id=$1`],
  ['work_orders sched', `SELECT count(*)::int c, count(scheduled_start)::int sched FROM work_orders WHERE tenant_id=$1`],
]) {
  try { console.log(label, JSON.stringify((await pool.query(sql, [T])).rows[0])); }
  catch (e) { console.log(label, 'ERR', e.code); }
}
await pool.end();
